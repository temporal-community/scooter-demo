import { strict as assert } from 'assert';
import { MockActivityEnvironment } from '@temporalio/testing';

process.env.STRIPE_API_KEY = 'test-key';

// Fake Stripe client used for tests
class FakeStripe {
  public customers = {
    search: async ({ query }: { query: string }) => {
      const email = /email:'([^']+)'/.exec(query)?.[1];
      if (email === 'missing@example.com') {
        return { data: [] };
      }
      return { data: [{ id: `cust_${email}` }] };
    },
  };
  public billing = {
    meterEvents: {
      create: async () => {
        return {};
      },
    },
  };
}

import * as activities from '../src/activities';
const {
  FindStripeCustomerID,
  BeginRide,
  PostTimeCharge,
  PostDistanceCharge,
  EndRide,
  CustomerNotFoundException,
  __test,
} = activities as typeof activities & { __test: { setStripeClient(client: any): void } };

__test.setStripeClient(new FakeStripe());

describe('activities', () => {
  it('FindStripeCustomerID returns customer id', async () => {
    const env = new MockActivityEnvironment();
    const id = await env.run(FindStripeCustomerID, { emailAddress: 'user@example.com', scooterId: '1111' });
    assert.equal(id, 'cust_user@example.com');
  });

  it('FindStripeCustomerID throws when not found', async () => {
    const env = new MockActivityEnvironment();
    await assert.rejects(
      env.run(FindStripeCustomerID, { emailAddress: 'missing@example.com', scooterId: '1111' }),
      CustomerNotFoundException
    );
  });

  it('FindStripeCustomerID fails on network outage for first attempts', async function () {
    this.timeout(7000);
    const env = new MockActivityEnvironment({ attempt: 2 });
    await assert.rejects(
      env.run(FindStripeCustomerID, { emailAddress: 'user@example.com', scooterId: '1234' }),
      /Network error/
    );

    const env2 = new MockActivityEnvironment({ attempt: 4 });
    const id = await env2.run(FindStripeCustomerID, { emailAddress: 'user@example.com', scooterId: '1234' });
    assert.equal(id, 'cust_user@example.com');
  });

  it('BeginRide validates scooter id', async () => {
    const env = new MockActivityEnvironment();
    await assert.rejects(
      env.run(BeginRide, { emailAddress: 'u', scooterId: '1239', customerId: 'c' }),
      /Invalid scooter ID/
    );

    const tokens = await env.run(BeginRide, { emailAddress: 'u', scooterId: '1230', customerId: 'c' });
    assert.equal(tokens, 10);
  });

  it('PostTimeCharge and PostDistanceCharge return token values', async () => {
    const env = new MockActivityEnvironment();
    const t = await env.run(PostTimeCharge, { customerId: 'c', emailAddress: '', scooterId: '' });
    const d = await env.run(PostDistanceCharge, { customerId: 'c', emailAddress: '', scooterId: '' });
    await env.run(EndRide, { customerId: 'c', emailAddress: '', scooterId: '' });
    assert.equal(t, 2);
    assert.equal(d, 5);
  });
});
