// Purpose: Custom hook to manage the ride timer.
import { useState, useEffect, useRef }
from 'react';

export const useRideTimer = (isActive: boolean): number => {
  const [localElapsedSeconds, setLocalElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setLocalElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive]);

  // Effect to reset timer when ride becomes inactive
  useEffect(() => {
    if (!isActive) {
        setLocalElapsedSeconds(0);
    }
  }, [isActive]);


  return localElapsedSeconds;
};