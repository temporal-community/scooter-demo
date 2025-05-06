import { useRideStore } from '../stores/rideStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startRide, endRide, getRideState, addDistance as addDistanceApi } from '../api/rideApi';
import { useEffect, useState, useRef } from 'react';

/** Converts raw seconds → "hh:mm" */
const fmtTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface RideStateResponse {
  distanceKm: number;
  elapsedSeconds: number;
  tokens: number;
}

export default function Hud() {
  const {
    distance, elapsed, tokens,
    reset, setDistance, setElapsed, setTokens, setIsAnimating,
  } = useRideStore();

  const [email, setEmail] = useState('');
  const [isRideActive, setIsRideActive] = useState(false);
  const rideIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      // In a real app, you might pass the email to startRide
      // For now, we'll just log it as it's not used by the mock API
      console.log('Starting ride for email:', email);
      return startRide();
    },
    onSuccess: () => {
      reset();
      setIsRideActive(true);
      setIsAnimating(true);
    },
  });

  const end = useMutation({
    mutationFn: endRide,
    onSuccess: () => {
      setIsRideActive(false);
      setIsAnimating(false);
      if (rideIntervalRef.current) {
        clearInterval(rideIntervalRef.current);
        rideIntervalRef.current = null;
      }
    },
  });

  const addDistanceMutation = useMutation({
    mutationFn: addDistanceApi,
    // onSuccess/onError can be added if needed for feedback
  });

  const { data, isLoading: isLoadingRideState } = useQuery<RideStateResponse>({
    queryKey: ['rideState'],
    queryFn: getRideState,
    refetchInterval: 1_000,
  });

  // Update store when data changes
  useEffect(() => {
    if (data) {
      setDistance(data.distanceKm);
      setElapsed(fmtTime(data.elapsedSeconds));
      setTokens(data.tokens);
    }
    if (isRideActive && data && data.distanceKm === 0 && data.elapsedSeconds === 0 && tokens !== 0) {
        // This condition might need refinement based on actual backend behavior for ended rides
        // Consider if backend signals ride truly ended or if it's just a reset to 0 for a new potential ride
        // If it means the workflow truly ended and we should lock things down:
        // setIsRideActive(false);
        // setIsAnimating(false);
    }
  }, [data, setDistance, setElapsed, setTokens, isRideActive, tokens, setIsAnimating]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' && isRideActive && !rideIntervalRef.current) {
        addDistanceMutation.mutate(); // Call once immediately
        rideIntervalRef.current = setInterval(() => {
          addDistanceMutation.mutate();
        }, 750); // Adjust interval for speed, e.g., every 750ms for 100ft
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' && rideIntervalRef.current) {
        clearInterval(rideIntervalRef.current);
        rideIntervalRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (rideIntervalRef.current) {
        clearInterval(rideIntervalRef.current);
      }
    };
  }, [isRideActive, addDistanceMutation]);

  let rideStatusMessage = "Enter your email and unlock the scooter to start your ride.";
  if (start.isPending) {
    rideStatusMessage = "Unlocking scooter...";
  } else if (end.isPending) {
    rideStatusMessage = "Ending ride...";
  } else if (isRideActive) {
    rideStatusMessage = "Ride in progress. Hold RIGHT ARROW (→) to move.";
  } else if (tokens > 0) { // Assumes tokens > 0 means a ride has occurred
    rideStatusMessage = "Ride ended. Unlock scooter to start a new ride.";
  }

  /* --- UI -------------------------------------------------- */

  return (
    <div className="space-y-4 p-4">
      <p className="text-center text-sm text-gray-600">{rideStatusMessage}</p>
      
      {!isRideActive && !start.isPending && (
        <input
          type="email"
          placeholder="maria@example.com"
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isRideActive || start.isPending}
        />
      )}

      <button
        className="btn btn-primary w-full"
        onClick={() => {
          if (email.trim() === '') {
            alert('Please enter an email address.'); // Basic validation
            return;
          }
          start.mutate();
        }}
        disabled={isRideActive || start.isPending || (tokens > 0 && !end.isSuccess && !isRideActive)} // Disable if ride active, pending, or ended but not explicitly reset for a new one
      >
        {isRideActive ? 'Scooter Unlocked' : 'Unlock Scooter'}
      </button>

      {isRideActive && (
        <button
          className="btn btn-secondary w-full"
          onClick={() => end.mutate()}
          disabled={!isRideActive || end.isPending}
        >
          End Ride
        </button>
      )}

      <div className="mt-6 space-y-1">
        <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
        <Stat label="Time" value={elapsed} />
        <Stat label="Cost (tokens)" value={tokens.toFixed(1)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
