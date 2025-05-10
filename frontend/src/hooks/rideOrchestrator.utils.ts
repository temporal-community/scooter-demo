import type { ActivePhase } from './rideOrchestrator.types';

/**
 * Checks if a given phase string is one of the defined active phases.
 * @param phase The phase string to check.
 * @returns True if the phase is an active phase, false otherwise.
 */
export const isActivePhase = (phase: string): phase is ActivePhase => {
  return phase === 'ACTIVE';
};

/**
 * Helper function for logging messages with a timestamp.
 * @param message The main message to log.
 * @param args Additional arguments to log.
 */
export const logTs = (message: string, ...args: any[]) => {
  // This helper prepends a timestamp to each console log for easier debugging.
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
};
