// API Request/Response Interfaces (matching your React app)

/**
 * Response from the getRideState endpoint.
 */
export interface RideStateResponse {
    distanceFt: number;
    elapsedSeconds: number;
    tokens: number;
}

/**
 * Request body for starting a ride.
 */
export interface StartRideRequest {
    scooterId: string;
    emailAddress: string;
    pricePerThousand?: number;  // price per 1000 tokens
    currency?: string;          // currency code (e.g., 'USD')
}

/**
 * Response from the startRide endpoint.
 */
export interface StartRideResponse {
    rideId: string;
    startedAt: number;
    workflowId: string;
}

/**
 * Request body for ending a ride or adding distance.
 */
export interface WorkflowActionRequest {
    workflowId: string;
}

/**
 * Generic success response for actions like ending a ride or adding distance.
 */
export interface ActionSuccessResponse {
    success: boolean;
    message?: string;
}

// Temporal Workflow related interfaces (Placeholders)
// These should ideally match the actual arguments and return types of your workflows/queries/signals

/**
 * Arguments for starting the scooter ride workflow.
 */
export interface ScooterRideWorkflowArgs {
    scooterId: string;
    emailAddress: string;
    customerId: string; // Example: to be looked up
    meterName: string;  // Example from your client.ts
    rideTimeoutSecs: number; // Example from your client.ts
    pricePerThousand?: number;
    currency?: string;
}

/**
 * Expected return type from the 'getRideDetailsQuery'.
 * This should match the structure of RideStateResponse.
 */
export type ScooterRideQueryState = RideStateResponse;

// You might have arguments for signals, e.g.,
// export interface AddDistanceSignalArgs {
//   distanceToAddFt: number;
// }

/**
 * Detailed ride status information including lifecycle, timestamps, and token breakdown.
 */
export interface RideStatus {
    /** High-level lifecycle */
    phase: 'INITIALIZING' | 'ACTIVE' | 'ENDED' | 'FAILED';

    /** Timestamps (ISO 8601) */
    startedAt: string;      // set when BeginRide succeeds
    lastMeterAt: string;    // update each time PostTimeCharge runs
    endedAt?: string;       // set when EndRide succeeds

    /** Usage counters */
    distanceFt: number;     // add 100 on every addDistance signal
    tokens: {
        unlock: number;
        time: number;
        distance: number;
        total: number;     // unlock + time + distance
    };

    /** Pricing */
    pricePerThousand?: number;  // price per 1000 tokens
    currency?: string;          // currency code (e.g., 'USD')

    /** Troubleshooting */
    lastError?: string;     // most recent ApplicationFailure.message
}
