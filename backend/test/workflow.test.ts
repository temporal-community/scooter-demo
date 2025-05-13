import { strict as assert } from 'assert';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
// use require to avoid type definitions
const { v4: uuid } = require('uuid');
import {
  ScooterRideWorkflow,
  addDistanceSignal,
  endRideSignal,
  approveRideSignal,
  tokensConsumedQuery,
  getRideDetailsQuery,
} from '../src/workflows';
import type { RideDetails } from '../src/interfaces/workflow';
import * as activitiesFile from '../src/activities';

// Use fake activities to avoid external dependencies
const fakeActivities = {
  async FindStripeCustomerID(_data: RideDetails) {
    const { attempt } = (await import('@temporalio/activity')).Context.current().info;
    if (_data.scooterId === '1234' && attempt <= 3) {
      throw new Error('Network error while attempting to contact Stripe');
    }
    if (_data.emailAddress === 'test@example.com') {
      throw new activitiesFile.CustomerNotFoundException('No customer found');
    }
    return 'cust-test';
  },
  async BeginRide() {
    return 10;
  },
  async PostTimeCharge() {
    return 2;
  },
  async PostDistanceCharge() {
    return 5;
  },
  async EndRide() {
    return;
  },
};

describe('ScooterRideWorkflow', function () {
  this.slow(1000);
  let env: TestWorkflowEnvironment;

  beforeEach(async function () {
    try {
      env = await TestWorkflowEnvironment.createTimeSkipping();
    } catch {
      this.skip();
    }
  });

  afterEach(async () => {
    await env?.teardown();
  });

  async function runWithWorker<T>(fn: (taskQueue: string) => Promise<T>): Promise<T> {
    const taskQueue = `test-${uuid()}`;
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../src/workflows'),
      activities: fakeActivities,
    });
    return worker.runUntil(fn(taskQueue));
  }

  it('completes a happy path ride', async () => {
    const result = await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(ScooterRideWorkflow, {
        args: [{ scooterId: '1230', emailAddress: 'good@example.com', rideTimeoutSecs: 60 }],
        taskQueue,
        workflowId: `wf-${uuid()}`,
      });
      await handle.signal(addDistanceSignal);
      await handle.signal(addDistanceSignal);
      await handle.signal(addDistanceSignal);
      await env.sleep('60s');
      await handle.signal(endRideSignal);
      return handle.result();
    });

    assert.equal(result.phase, 'ENDED');
    assert.equal(result.distanceFt, 300);
    assert.equal(result.tokens.total, 10 + 3 * 2 + 3 * 5);
  });

  it('recovers from transient Stripe failure', async () => {
    const result = await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(ScooterRideWorkflow, {
        args: [{ scooterId: '1234', emailAddress: 'good@example.com', rideTimeoutSecs: 20 }],
        taskQueue,
        workflowId: `wf-${uuid()}`,
      });
      await env.sleep('20s');
      await handle.signal(endRideSignal);
      return handle.result();
    });
    assert.equal(result.phase, 'ENDED');
  });

  it('fails on non-retryable error', async () => {
    await assert.rejects(
      runWithWorker(async (taskQueue) =>
        env.client.workflow.execute(ScooterRideWorkflow, {
          args: [{ scooterId: '1233', emailAddress: 'test@example.com' }],
          taskQueue,
          workflowId: `wf-${uuid()}`,
        })
      )
    );
  });

  it('unblocks when approve signal received', async () => {
    const result = await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(ScooterRideWorkflow, {
        args: [{ scooterId: '2000', emailAddress: 'good@example.com', rideTimeoutSecs: 200 }],
        taskQueue,
        workflowId: `wf-${uuid()}`,
      });
      // consume lots of tokens quickly
      for (let i = 0; i < 15; i++) {
        await handle.signal(addDistanceSignal);
      }
      await env.sleep('5s');
      await handle.signal(approveRideSignal);
      await env.sleep('5s');
      await handle.signal(endRideSignal);
      return handle.result();
    });
    assert.equal(result.phase, 'ENDED');
    assert.ok(result.tokens.total >= 70);
  });

  it('provides progress via queries', async () => {
    await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(ScooterRideWorkflow, {
        args: [{ scooterId: '3001', emailAddress: 'good@example.com', rideTimeoutSecs: 60 }],
        taskQueue,
        workflowId: `wf-${uuid()}`,
      });
      await handle.signal(addDistanceSignal);
      await env.sleep('16s');
      const tokens = await handle.query(tokensConsumedQuery as any);
      assert.equal(tokens, 10 + 5 + 2);
      const details = (await handle.query(getRideDetailsQuery as any)) as { status: { distanceFt: number } };
      assert.equal(details.status.distanceFt, 100);
      await handle.signal(endRideSignal);
      await handle.result();
    });
  });

  it('times out when approval not received', async () => {
    const result = await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(ScooterRideWorkflow, {
        args: [{ scooterId: '3000', emailAddress: 'good@example.com', rideTimeoutSecs: 200 }],
        taskQueue,
        workflowId: `wf-${uuid()}`,
      });
      for (let i = 0; i < 15; i++) {
        await handle.signal(addDistanceSignal);
      }
      await env.sleep('70s');
      return handle.result();
    });
    assert.equal(result.phase, 'TIMED_OUT');
  });
});
