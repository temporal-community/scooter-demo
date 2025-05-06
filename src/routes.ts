import express, { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getTemporalClient,
  startScooterWorkflow,
  endRideWorkflow,
  addDistanceToWorkflow,
  getTokensConsumed
} from './temporalClient';
import { getEnvConfig } from './env';
import {
  StartRideRequest,
  StartRideResponse,
  WorkflowActionRequest,
  ActionSuccessResponse,
  RideStateResponse,
  ScooterRideWorkflowArgs
} from './interfaces';
import { Client, WorkflowNotFoundError, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';

const router = Router();
const envConfig = getEnvConfig(); // Get env config once

// Request logging middleware
router.use((req: Request, res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Middleware to handle async route handlers and errors
const asyncHandler = (fn: (req: Request, res: Response, client: Client) => Promise<Response | void>) =>
  async (req: Request, res: Response) => {
    try {
      const client = await getTemporalClient();
      await fn(req, res, client);
    } catch (error: any) {
      console.error('API Error:', error);
      if (error instanceof WorkflowNotFoundError) {
        return res.status(404).json({ message: 'Ride (workflow) not found.', error: error.message });
      }
      if (error instanceof WorkflowExecutionAlreadyStartedError) {
        return res.status(409).json({ message: 'Ride (workflow) already started for this scooter.', error: error.message });
      }
      // Distinguish Temporal connection errors from other errors
      if (error.message && error.message.startsWith('Failed to connect to Temporal server')) {
         return res.status(503).json({ message: 'Service unavailable: Could not connect to Temporal.', error: error.message });
      }
      res.status(500).json({ message: 'An internal server error occurred.', error: error.message });
    }
  };

/**
 * POST /ride/start
 * Starts a new scooter ride.
 */
router.post('/ride/start', asyncHandler(async (req: Request, res: Response, client: Client) => {
  const { scooterId, emailAddress } = req.body as StartRideRequest;

  if (!scooterId || !emailAddress) {
    return res.status(400).json({ message: 'scooterId and emailAddress are required.' });
  }

  const workflowId = `scooter-session-${scooterId}`; // Consistent with your React example
  const rideId = uuidv4(); // Generate a unique ride ID for the API response
  const startedAt = Date.now();

  const workflowArgs: ScooterRideWorkflowArgs = {
    scooterId,
    emailAddress,
    customerId: `cust-${emailAddress.split('@')[0]}`, // Placeholder customerId logic
    meterName: 'scooter-ride-tq', // Example from your client.ts
    rideTimeoutSecs: 60 * 60 * 3,  // 3 hours, example from your client.ts
  };

  await startScooterWorkflow(client, envConfig.temporalTaskQueue, workflowArgs, workflowId);

  const response: StartRideResponse = {
    rideId,
    startedAt,
    workflowId,
  };
  res.status(201).json(response);
}));

/**
 * POST /ride/end
 * Ends an existing scooter ride.
 */
router.post('/ride/end', asyncHandler(async (req: Request, res: Response, client: Client) => {
  const { workflowId } = req.body as WorkflowActionRequest;

  if (!workflowId) {
    return res.status(400).json({ message: 'workflowId is required.' });
  }

  await endRideWorkflow(client, workflowId);

  const response: ActionSuccessResponse = {
    success: true,
    message: 'Ride end signal sent.',
  };
  res.status(200).json(response);
}));

/**
 * GET /ride/state
 * Gets the current state of a ride.
 * Uses workflowId as a path parameter for RESTful design.
 */
router.get('/ride/state/:workflowId', asyncHandler(async (req: Request, res: Response, client: Client) => {
  const { workflowId } = req.params;

  if (!workflowId) {
    // This case should ideally be caught by Express routing if param is missing,
    // but good for explicit validation.
    return res.status(400).json({ message: 'workflowId path parameter is required.' });
  }

  const tokensConsumed = await getTokensConsumed(client, workflowId);
  res.status(200).json({ tokensConsumed });
}));

/**
 * POST /ride/add-distance
 * Adds distance to an ongoing ride.
 */
router.post('/ride/add-distance', asyncHandler(async (req: Request, res: Response, client: Client) => {
  const { workflowId } = req.body as WorkflowActionRequest;
  // const { distance } = req.body; // If you decide to pass distance in the request

  if (!workflowId) {
    return res.status(400).json({ message: 'workflowId is required.' });
  }

  // If your addDistanceSignal takes arguments, pass them here.
  // For example: await addDistanceToWorkflow(client, workflowId, distance);
  await addDistanceToWorkflow(client, workflowId);

  const response: ActionSuccessResponse = {
    success: true,
    message: 'Add distance signal sent.',
  };
  res.status(200).json(response);
}));

export default router;
