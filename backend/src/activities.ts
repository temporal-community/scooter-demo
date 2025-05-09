import * as activity from '@temporalio/activity';
import { log } from '@temporalio/activity';

const stripeApiKey = process.env["STRIPE_API_KEY"];
if (!stripeApiKey) {
	throw new ReferenceError(`STRIPE_API_KEY environment variable is not defined`);
}
const stripe = require('stripe')(
	stripeApiKey,
	{ apiVersion: '2025-04-30.preview' }
);

// These define how many tokens are consumed for different aspects of the ride
const TokensForUnlock = 10;
const TokensForTime = 2;
const TokensForDistance = 5;

// Type used as input to the workflow
export interface RideDetails {
	emailAddress: string;
	customerId?: string;
	scooterId?: string;
}

export async function FindStripeCustomerID(data: RideDetails): Promise<string> {
	const email = data.emailAddress;
	log.info(`Searching for Stripe customer with email: ${email}`);

    const { attempt } = activity.Context.current().info;

    // Simulate a brief network outage that prevents us from issuing a
	// request to the Stripe API for the first 3 attempts
    if (attempt <= 3 && data.scooterId === '1234') {
        log.info(`Cannot access Stripe API (attempt ${attempt})`);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // simulate delay
        throw new Error('Network error while attempting to contact Stripe');
    }

	const customers = await stripe.customers.search({
		query: `email:'${email}'`,
	});

	if (customers.data.length > 0) {
	    log.info(`Found Stripe customer ID for email: ${email}`);
		const customer = customers.data[0];
		return customer.id;
	}
	log.info(`No customer found with email: ${email}`);
	throw new CustomerNotFoundException(`No customer found with email: ${email}`);
}

export async function BeginRide(data: RideDetails): Promise<number> {
    // Verify that this is a valid scooter ID (must contain only digits)
    if (! /^[0-8]+$/.test(data.scooterId!)) { // THIS IS A BUG, comment me!
	// if (! /^[0-9]+$/.test(data.scooterId!)) { // Uncomment me to fix!
        throw new Error(`Invalid scooter ID ${data.scooterId}`);
    }
	await PostStripeMeterEvent(data.customerId!, TokensForUnlock);
	return TokensForUnlock;
}

export async function PostTimeCharge(data: RideDetails): Promise<number> {
	await PostStripeMeterEvent(data.customerId!, TokensForTime);
	return TokensForTime;
}

export async function PostDistanceCharge(data: RideDetails): Promise<number> {
	await PostStripeMeterEvent(data.customerId!, TokensForDistance);
	return TokensForDistance;
}

export async function EndRide(data: RideDetails): Promise<void> {
	log.info('Ride ending');
}

async function PostStripeMeterEvent(stripeCustomerId: string, tokensConsumed: number): Promise<void> {
	log.info(`Posting ${tokensConsumed} tokens consumed to Stripe for customer ${stripeCustomerId}`);

	try {
		await stripe.billing.meterEvents.create({
			event_name: 'tokens_consumed',
			payload: {
				value: tokensConsumed.toString(),
				stripe_customer_id: stripeCustomerId,
			},
			identifier: `ride_${stripeCustomerId}_${Date.now()}`, // TW: Seems like a poor choice of idempotency key
		});
	} catch (err: any) {
		console.error(`Stripe error: ${err.message}`);
		throw err;
	}
}

export class CustomerNotFoundException extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = CustomerNotFoundException.name;
  }
}
