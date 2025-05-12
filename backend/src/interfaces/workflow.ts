/**
 * Interfaces for the Scooter Ride Workflow
 */

export interface RideDetails {
  emailAddress: string; // what the user provides to us
  scooterId: string;
  customerId?: string;  // what we look up from Stripe (based on the email address)
  rideTimeoutSecs?: number;  // maximum ride duration
  pricePerThousand?: number;  // price per 1000 tokens
  currency?: string;          // currency code (e.g., 'USD')
}

export interface RideStatus {
    /** High-level lifecycle */
    phase: 'INITIALIZING' | 'ACTIVE' | 'BLOCKED' | 'ENDED' | 'FAILED' | 'TIMED_OUT';

    /** Timestamps (ISO 8601) */
    startedAt: string;      // set when BeginRide succeeds
    lastMeterAt: string;    // update each time PostTimeCharge runs
    endedAt?: string;       // set when EndRide succeeds

    /** Usage counters */
    distanceFt: number;     // add 100 on every addDistance signal
    tokens: {
        unlock:   number;
        time:     number;
        distance: number;
        total:    number;     // unlock + time + distance
    };

    /** Troubleshooting */
    lastError?: string;     // most recent ApplicationFailure.message
} 
