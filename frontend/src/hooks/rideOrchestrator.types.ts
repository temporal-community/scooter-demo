/**
 * Defines the active phases a ride can be in.
 */
export const ACTIVE_PHASES = ['INITIALIZING', 'ACTIVE', 'BLOCKED'] as const;
export type ActivePhase = typeof ACTIVE_PHASES[number];

/**
 * Represents the status object within a ride state response.
 * This should align with your actual API response structure.
 */
export interface RideStateStatus {
  phase: string; // e.g., 'INITIALIZING', 'ACTIVE', 'BLOCKED', 'ENDED', 'FAILED'
  startedAt?: string; // ISO date string
  endedAt?: string; // ISO date string
  tokens?: { total: number };
  lastError?: string | null;
}

/**
 * Represents the overall response for a ride's state.
 * This should align with your actual API response structure.
 */
export interface RideStateResponse {
  workflowId: string;
  status: RideStateStatus;
}