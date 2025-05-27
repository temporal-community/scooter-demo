const assert = require('assert').strict;
const express = require('express');
const http = require('http');
const { WorkflowNotFoundError } = require('@temporalio/client');

process.env.TEMPORAL_TASK_QUEUE = 'test-tq';

function requestApp(app, method, path, data) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const opts = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: { 'content-type': 'application/json' },
      };
      const req = http.request(opts, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : undefined });
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  });
}

function setup(stubs = {}) {
  const temporal = require('../src/temporalClient');
  temporal.getTemporalClient = async () => ({ stub: true });
  temporal.startScooterWorkflow = stubs.startScooterWorkflow || (async () => {});
  temporal.endRideWorkflow = stubs.endRideWorkflow || (async () => {});
  temporal.addDistanceToWorkflow = stubs.addDistanceToWorkflow || (async () => {});
  temporal.getRideDetails =
    stubs.getRideDetails ||
    (async () => ({
      phase: 'ACTIVE',
      startedAt: new Date().toISOString(),
      lastMeterAt: new Date().toISOString(),
      distanceFt: 0,
      tokens: { unlock: 0, time: 0, distance: 0, total: 0 },
    }));
  delete require.cache[require.resolve('../src/routes')];
  const router = require('../src/routes').default;
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
}

describe('API routes', () => {
  it('POST /ride/start starts a ride', async () => {
    let called = false;
    const app = setup({
      startScooterWorkflow: async (_c, tq, args, wfId) => {
        called = true;
        assert.equal(tq, 'test-tq');
        assert.equal(wfId, 'scooter-session-123');
        assert.equal(args.scooterId, '123');
        assert.equal(args.emailAddress, 'user@example.com');
      },
    });

    const res = await requestApp(app, 'POST', '/ride/start', { scooterId: '123', emailAddress: 'user@example.com' });

    assert.equal(res.status, 201);
    assert.ok(called);
    assert.ok(res.body.rideId);
    assert.ok(res.body.startedAt);
    assert.equal(res.body.workflowId, 'scooter-session-123');
  });

  it('POST /ride/start validates input', async () => {
    const app = setup();
    const res = await requestApp(app, 'POST', '/ride/start', { emailAddress: 'user@example.com' });
    assert.equal(res.status, 400);
  });

  it('POST /ride/start handles errors', async () => {
    const app = setup({
      startScooterWorkflow: async () => {
        throw new Error('boom');
      },
    });
    const res = await requestApp(app, 'POST', '/ride/start', { scooterId: '99', emailAddress: 'u@example.com' });
    assert.equal(res.status, 500);
  });

  it('POST /ride/end ends a ride', async () => {
    let called = false;
    const app = setup({
      endRideWorkflow: async (_c, wfId) => {
        called = wfId === 'wf1';
      },
    });
    const res = await requestApp(app, 'POST', '/ride/end', { workflowId: 'wf1' });
    assert.equal(res.status, 200);
    assert.ok(called);
  });

  it('POST /ride/end validates input', async () => {
    const app = setup();
    const res = await requestApp(app, 'POST', '/ride/end', {});
    assert.equal(res.status, 400);
  });

  it('POST /ride/add-distance signals workflow', async () => {
    let called = false;
    const app = setup({
      addDistanceToWorkflow: async (_c, wfId) => {
        called = wfId === 'wf2';
      },
    });
    const res = await requestApp(app, 'POST', '/ride/add-distance', { workflowId: 'wf2' });
    assert.equal(res.status, 200);
    assert.ok(called);
  });

  it('POST /ride/add-distance validates input', async () => {
    const app = setup();
    const res = await requestApp(app, 'POST', '/ride/add-distance', {});
    assert.equal(res.status, 400);
  });

  it('GET /ride/state returns ride details', async () => {
    const app = setup({
      getRideDetails: async () => ({ distanceFt: 100, elapsedSeconds: 5, tokens: 10 }),
    });
    const res = await requestApp(app, 'GET', '/ride/state/wf3');
    assert.equal(res.status, 200);
    assert.equal(res.body.distanceFt, 100);
  });

  it('GET /ride/state handles not found', async () => {
    const app = setup({
      getRideDetails: async () => {
        throw new WorkflowNotFoundError('not found');
      },
    });
    const res = await requestApp(app, 'GET', '/ride/state/wfX');
    assert.equal(res.status, 404);
  });

  it('GET /ride/state handles timeout', async function () {
    this.timeout(4000);
    const app = setup({
      getRideDetails: async () => new Promise((resolve) => setTimeout(() => resolve({}), 3000)),
    });
    const res = await requestApp(app, 'GET', '/ride/state/wfY');
    assert.equal(res.status, 500);
  });
});
