import fs from 'fs/promises';
import { Connection, Client, WorkflowHandle, WorkflowNotFoundError } from '@temporalio/client';
import { getEnvConfig, EnvConfig } from './env';
import {
  ScooterRideWorkflowArgs,
  ScooterRideQueryState,
  // AddDistanceSignalArgs // Uncomment if your signal takes args
} from './interfaces';
import {
  WORKFLOW_SCOOTER_RIDE,
  SIGNAL_ADD_DISTANCE,
  SIGNAL_END_RIDE,
  QUERY_GET_RIDE_DETAILS
} from './workflows';

let temporalClient: Client | null = null;

/**
 * Initializes and returns a Temporal Client instance.
 * It creates a singleton client instance.
 * @returns A Promise resolving to the Temporal Client.
 * @throws Error if connection to Temporal server fails.
 */
export async function getTemporalClient(): Promise<Client> {
  if (temporalClient) {
    return temporalClient;
  }

  const env = getEnvConfig();
  let connection: Connection;

  try {
    if (env.temporalClientCertPath && env.temporalClientKeyPath) {
      console.log('Attempting to connect to Temporal server using mTLS...');
      const clientCert = await fs.readFile(env.temporalClientCertPath);
      const clientKey = await fs.readFile(env.temporalClientKeyPath);
      const serverRootCACertificate = env.temporalServerRootCACertPath
        ? await fs.readFile(env.temporalServerRootCACertPath)
        : undefined;

      connection = await Connection.connect({
        address: env.temporalAddress,
        tls: {
          serverNameOverride: env.temporalServerNameOverride,
          serverRootCACertificate,
          clientCertPair: {
            crt: clientCert,
            key: clientKey,
          },
        },
      });
      console.log('Successfully connected to Temporal server using mTLS.');
    } else if (env.temporalApiKey) {
      console.log('Attempting to connect to Temporal server using API key...');
      connection = await Connection.connect({
        address: env.temporalAddress,
        tls: true, // TLS is typically required for API key auth with Temporal Cloud
        apiKey: env.temporalApiKey,
        // For Temporal Cloud, namespace is often part of the address or handled differently.
        // If connecting to a self-hosted cluster that uses API keys and namespaces,
        // you might need to adjust metadata or connection options.
        // metadata: { 'temporal-namespace': env.temporalNamespace }, // May not be needed for Temporal Cloud
      });
      console.log('Successfully connected to Temporal server using API key.');
    } else {
      console.log('Attempting to connect to Temporal server using unencrypted connection (not recommended for production)...');
      connection = await Connection.connect({ address: env.temporalAddress });
      console.log('Successfully connected to Temporal server (unencrypted).');
    }

    temporalClient = new Client({
      connection,
      namespace: env.temporalNamespace,
    });
    console.log(`Temporal client initialized for namespace: ${env.temporalNamespace}`);
    return temporalClient;
  } catch (error) {
    console.error('Failed to connect to Temporal server:', error);
    throw new Error(`Failed to connect to Temporal server: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Starts the scooter ride workflow.
 * @param client - The Temporal Client instance.
 * @param taskQueue - The task queue for the workflow.
 * @param args - Arguments for the workflow.
 * @param workflowId - The ID for the workflow.
 * @returns A Promise resolving to the WorkflowHandle.
 */
export async function startScooterWorkflow(
  client: Client,
  taskQueue: string,
  args: ScooterRideWorkflowArgs,
  workflowId: string
): Promise<WorkflowHandle> {
  console.log(`Starting workflow ${WORKFLOW_SCOOTER_RIDE} with ID: ${workflowId} on task queue: ${taskQueue}`);
  try {
    const handle = await client.workflow.start(WORKFLOW_SCOOTER_RIDE, {
      taskQueue: taskQueue,
      workflowId: workflowId,
      args: [args], // Workflow arguments are passed as an array
    });
    console.log(`Workflow started successfully. Workflow ID: ${handle.workflowId}, Run ID: ${handle.firstExecutionRunId}`);
    return handle;
  } catch (error) {
    console.error(`Error starting workflow ${workflowId}:`, error);
    throw error;
  }
}

/**
 * Sends a signal to a running workflow.
 * @param client - The Temporal Client instance.
 * @param workflowId - The ID of the workflow to signal.
 * @param signalName - The name of the signal.
 * @param signalArgs - (Optional) Arguments for the signal.
 * @returns A Promise that resolves when the signal is sent.
 */
export async function signalWorkflow(
  client: Client,
  workflowId: string,
  signalName: string,
  signalArgs?: unknown[] // Array of arguments for the signal
): Promise<void> {
  console.log(`Signaling workflow ${workflowId} with signal ${signalName}`);
  try {
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(signalName, ...(signalArgs || []));
    console.log(`Signal ${signalName} sent successfully to workflow ${workflowId}.`);
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
        console.error(`Workflow with ID ${workflowId} not found when trying to send signal ${signalName}.`);
    } else {
        console.error(`Error signaling workflow ${workflowId} with ${signalName}:`, error);
    }
    throw error;
  }
}

/**
 * Queries a running workflow.
 * @param client - The Temporal Client instance.
 * @param workflowId - The ID of the workflow to query.
 * @param queryName - The name of the query.
 * @param queryArgs - (Optional) Arguments for the query.
 * @returns A Promise resolving to the query result.
 */
export async function queryWorkflow<TResult>(
  client: Client,
  workflowId: string,
  queryName: string,
  queryArgs: unknown[] = []
): Promise<TResult> {
  console.log(`Querying workflow ${workflowId} with query ${queryName}`);
  try {
    const handle = client.workflow.getHandle(workflowId);
    const result = await handle.query<TResult>(queryName);
    console.log(`Query ${queryName} for workflow ${workflowId} successful.`);
    return result;
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
        console.error(`Workflow with ID ${workflowId} not found when trying to query ${queryName}.`);
    } else {
        console.error(`Error querying workflow ${workflowId} with ${queryName}:`, error);
    }
    throw error;
  }
}

// Specific interaction functions for scooter ride workflows

/**
 * Ends a scooter ride by signaling the workflow.
 * @param client - The Temporal Client instance.
 * @param workflowId - The ID of the workflow representing the ride.
 */
export async function endRideWorkflow(client: Client, workflowId: string): Promise<void> {
  await signalWorkflow(client, workflowId, SIGNAL_END_RIDE);
}

/**
 * Adds distance to a scooter ride by signaling the workflow.
 * @param client - The Temporal Client instance.
 * @param workflowId - The ID of the workflow representing the ride.
 * // @param distance - The distance to add (if your signal takes arguments)
 */
export async function addDistanceToWorkflow(
  client: Client,
  workflowId: string
  // distance?: number // Example: if your signal takes an argument
): Promise<void> {
  // const signalArgs = distance !== undefined ? [{ distanceToAddFt: distance }] : []; // Adjust if signal takes args
  await signalWorkflow(client, workflowId, SIGNAL_ADD_DISTANCE /*, signalArgs */);
}

/**
 * Gets the current state of a scooter ride by querying the workflow.
 * @param client - The Temporal Client instance.
 * @param workflowId - The ID of the workflow representing the ride.
 * @returns A Promise resolving to the ride state.
 */
export async function getRideStateFromWorkflow(client: Client, workflowId: string): Promise<ScooterRideQueryState> {
  return queryWorkflow<ScooterRideQueryState>(client, workflowId, QUERY_GET_RIDE_DETAILS);
}
