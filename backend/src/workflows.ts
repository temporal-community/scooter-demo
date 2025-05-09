/**
 * RideShareScooterSession workflow
 *
 * • `addDistance(feet)` — signal from the scooter firmware / mobile app
 * • `endRide()` — signal when the user taps "End Ride"
 * • One Stripe meter‑event is posted at the end with the total charge (as a # of tokens consumed)
 */
import {
  proxyActivities,
  condition,
  defineSignal,
  defineQuery,
  setHandler,
  sleep,
  ApplicationFailure,
} from '@temporalio/workflow';

import type * as activities from '../src/activities';
import { RideDetails, RideStatus } from './interfaces/workflow';

// Signal & query definitions
export const addDistanceSignal = defineSignal('addDistance');
export const approveRideSignal = defineSignal('approveRide');
export const endRideSignal = defineSignal('endRide');
export const tokensConsumedQuery = defineQuery('tokensConsumed');
export const getRideDetailsQuery = defineQuery('getRideDetails');

// After this many tokens have been consumed in a single ride, 
// the Workflow Execution blocks until it receives the approveRide
// Signal. It ends if this approval isn't received quickly enough.  
const TokenConsumptionApprovalLimit = 70;

export async function ScooterRideWorkflow(input: RideDetails): Promise<RideStatus> {
  let hasRideEnded = false;
  let hasBeenApproved = false;
  let isApprovalRequired = false;
  let rideStatus: RideStatus = {
    phase: 'INITIALIZING',
    startedAt: new Date().toISOString(),
    lastMeterAt: new Date().toISOString(),
    distanceFt: 0,
    tokens: {
      unlock: 0,
      time: 0,
      distance: 0,
      total: 0,
    },
  };

  const {
    FindStripeCustomerID,
    BeginRide,
    PostTimeCharge,
    PostDistanceCharge,
    EndRide,
  } = proxyActivities<typeof activities>({
    startToCloseTimeout: '1 minute',
    retry: {
      initialInterval: '1s',
      backoffCoefficient: 2.0,
      maximumInterval: '100s',
      nonRetryableErrorTypes: ['CustomerNotFoundException'],
    },
  });

  const pendingDistances: number[] = [];

  // --- Wake‑up promise machinery ---
  let wakeResolver: (() => void) | undefined;
  const newWakePromise = () =>
    new Promise<void>((resolve) => {
      wakeResolver = resolve;
    });
  let wakePromise = newWakePromise();
  // ----------------------------------

  try {
    // Query handlers
    setHandler(tokensConsumedQuery, () => rideStatus.tokens.total);
    setHandler(getRideDetailsQuery, () => ({ ...input, status: rideStatus }));

    // Signal handlers
    setHandler(addDistanceSignal, () => {
      pendingDistances.push(1); // 100 ft per signal
      wakeResolver?.();
    });
    setHandler(endRideSignal, () => {
      hasRideEnded = true;
      wakeResolver?.();
    });
    setHandler(approveRideSignal, () => {
      isApprovalRequired = false;
      hasBeenApproved = true;
      rideStatus.phase = 'ACTIVE';
      wakeResolver?.();
    });

    // Activity 1: lookup Stripe customer
    input.customerId = await FindStripeCustomerID(input);
    // Activity 2: unlock ride
    const unlockTokens = await BeginRide(input);
    rideStatus.tokens.unlock = unlockTokens;
    rideStatus.tokens.total += unlockTokens;
    rideStatus.phase = 'ACTIVE';
    rideStatus.lastMeterAt = new Date().toISOString();

    // ---------------- Core loop ----------------
    const TIMER_EVENT = 'TIMER_EVENT';
    const SIGNAL_EVENT = 'SIGNAL_EVENT';

    // Create **one** timer; it will be replaced only when it fires
    let timerPromise: Promise<typeof TIMER_EVENT> = sleep(15_000).then(
      () => TIMER_EVENT,
    );

    while (!hasRideEnded) {
      // Drain distance queue first
      while (pendingDistances.length && !hasRideEnded) {
        if (rideStatus.tokens.unlock == 0) {
          // Distance signals aren't valid if the scooter is locked
          continue;
        }
        pendingDistances.shift();
        const distanceTokens = await PostDistanceCharge(input);
        rideStatus.tokens.distance += distanceTokens;
        rideStatus.tokens.total += distanceTokens;
        rideStatus.distanceFt += 100;
      }
      if (hasRideEnded) break;

      const event = await Promise.race([
        timerPromise,
        wakePromise.then(() => SIGNAL_EVENT),
      ]);

      // Prepare next wake promise
      wakePromise = newWakePromise();

      if (event === TIMER_EVENT) {
        // 15‑second timer fired – post time charge and start a **new** timer
        const timeTokens = await PostTimeCharge(input);
        rideStatus.tokens.time += timeTokens;
        rideStatus.tokens.total += timeTokens;
        rideStatus.lastMeterAt = new Date().toISOString();

        timerPromise = sleep(15_000).then(() => TIMER_EVENT);
      }

      if (rideStatus.tokens.total >= TokenConsumptionApprovalLimit && ! hasBeenApproved) {
        isApprovalRequired = true;
        rideStatus.phase = 'BLOCKED';

        const approvalOrEnd = !(await condition(() => !isApprovalRequired || hasRideEnded, '1 minute'));
        if (approvalOrEnd) {
          // end the Workflow Execution (and the ride)
          await EndRide(input);
          rideStatus.phase = 'ENDED';
          rideStatus.endedAt = new Date().toISOString();
          return rideStatus;
        }

        if (hasRideEnded) {
          await EndRide(input);
          rideStatus.phase = 'ENDED';
          rideStatus.endedAt = new Date().toISOString();
          return rideStatus;        // leave the workflow instantly
        }
      }
      // If SIGNAL_EVENT, loop reiterates — existing timer remains untouched
    }
    // -------------------------------------------

    // Activity: End ride
    if (rideStatus.phase === 'ACTIVE' || rideStatus.phase === 'BLOCKED') {
      await EndRide(input);
      rideStatus.phase = 'ENDED';
      rideStatus.endedAt = new Date().toISOString();
    }

    return rideStatus;
  } catch (err) {
    rideStatus.phase = 'FAILED';
    rideStatus.lastError = err instanceof Error ? err.message : String(err);
    if (err instanceof ApplicationFailure) throw err;
    throw new ApplicationFailure(
      `Ride workflow failed: ${rideStatus.lastError}`,
      err instanceof Error ? err.constructor.name : 'UnknownError',
      true,
    );
  }
}
