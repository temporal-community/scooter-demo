/**
 * This file contains constants for workflow names, signal names, and query names.
 * These names must match the ones defined in your Temporal worker code.
 */

// Workflow Names
export const WORKFLOW_SCOOTER_RIDE = 'ScooterRideWorkflow';

// Signal Names
export const SIGNAL_END_RIDE = 'endRideSignal';
export const SIGNAL_ADD_DISTANCE = 'addDistanceSignal';

// Query Names
export const QUERY_TOKENS_CONSUMED = 'tokensConsumed';
 