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
   