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
  phase: 'INITIALIZING' | 'ACTIVE' | 'ENDED' | 'FAILED' | 'BLOCKED' | 'TIMED_OUT';
  startedAt: string;
  lastMeterAt: string;
  endedAt?: string;
  distanceFt: number;
  tokens: {
    unlock: number;
    time: number;
    distance: number;
    total: number;
  };
  lastError?: string;
}

/**
 * Represents the overall response for a ride's state.
 * This should align with your actual API response structure.
 */
export interface RideStateResponse {
  scooterId: string;
  emailAddress: string;
  customerId: string;
  meterName: string;
  rideTimeoutSecs: number;
  pricePerThousand: number;
  currency: string;
  status: RideStateStatus;
}