/**
 * This file contains constants for workflow names, signal names, and query names.
 * These names must match the ones defined in your Temporal worker code.
 */

// Workflow Names
export const WORKFLOW_SCOOTER_RIDE = 'scooter-session-'; // Replace with your actual workflow name

// Signal Names
export const SIGNAL_END_RIDE = 'endRideSignal';             // Replace with your actual signal name for ending a ride
export const SIGNAL_ADD_DISTANCE = 'addDistanceSignal';     // Replace with your actual signal name for adding distance

// Query Names
export const QUERY_GET_RIDE_DETAILS = 'getRideDetailsQuery'; // Replace with your actual query name for ride state
 