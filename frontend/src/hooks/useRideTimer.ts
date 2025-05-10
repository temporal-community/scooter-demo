// frontend/src/hooks/useRideTimer.ts
import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to manage a ride timer.
 * If rideStartTimeEpochMs is provided and isActive is true, it calculates elapsed time from that start time.
 * Otherwise, it shows 0.
 * @param isActive Whether the ride is currently active.
 * @param rideStartTimeEpochMs The epoch milliseconds when the ride started. Null if not started or unknown.
 * @returns The number of elapsed seconds.
 */
export const useRideTimer = (isActive: boolean, rideStartTimeEpochMs: number | null): number => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (isActive && rideStartTimeEpochMs !== null) {
      // Function to calculate elapsed time based on the start time
      const calculateAndUpdateElapsedTime = () => {
        const now = Date.now();
        const currentElapsed = Math.max(0, Math.floor((now - rideStartTimeEpochMs) / 1000));
        setElapsedSeconds(currentElapsed);
      };

      calculateAndUpdateElapsedTime(); // Set initial value immediately

      // Update every second
      timerRef.current = setInterval(calculateAndUpdateElapsedTime, 1000);
    } else {
      // If not active or no start time, clear interval and reset seconds
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
      setElapsedSeconds(0);
    }

    // Cleanup function to clear interval when component unmounts or dependencies change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [isActive, rideStartTimeEpochMs]); // Re-run effect if isActive or rideStartTimeEpochMs changes

  return elapsedSeconds;
};