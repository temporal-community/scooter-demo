import { Client } from '@temporalio/client';
import { ScooterRideWorkflow } from './workflows';

export interface ScooterSessionParams {
  scooterId: string;
  emailAddress: string;
  customerId?: string;
  meterName: string;
  rideTimeoutSecs?: number;
  pricePerThousand?: number;  // price per 1000 tokens
  currency?: string;          // currency code (e.g., 'USD')
}

export async function runWorkflow(
  client: Client,
  taskQueue: string,
  params: ScooterSessionParams
): Promise<void> {
  try {
    // Set default pricing if not provided
    const workflowParams = {
      ...params,
      pricePerThousand: params.pricePerThousand ?? 25,
      currency: params.currency ?? 'USD'
    };

    const result = await client.workflow.execute(ScooterRideWorkflow, {
      taskQueue,
      workflowId: `scooter-session-${params.scooterId}`,
      args: [workflowParams],
    });

    console.log(`Scooter session workflow succeeded:`, result);
  } catch (error) {
    console.error(`Scooter session workflow failed:`, error);
  }
}
