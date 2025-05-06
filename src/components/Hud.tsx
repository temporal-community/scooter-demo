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
  const [localElapsedSeconds, setLocalElapsedSeconds] = useState(0);
  const [currentDistance, setCurrentDistance] = useState(0);
  const lastDistanceMilestoneRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [showSummary, setShowSummary] = useState(false);

  // Timer effect
  useEffect(() => {
    if (isRideActive) {
      // Start the timer
      timerRef.current = setInterval(() => {
        setLocalElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      // Clear the timer when ride is not active
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRideActive]);

  const start = useMutation({
    mutationFn: async () => {
      console.log('Starting ride for email:', email);
      return startRide();
    },
    onSuccess: () => {
      reset();
      setLocalElapsedSeconds(0); // Reset local timer
      setCurrentDistance(0); // Reset distance
      setIsRideActive(true);
      setIsAnimating(true);
      setShowSummary(false); // Hide summary when starting a new ride
    },
  });

  const end = useMutation({
    mutationFn: endRide,
    onSuccess: () => {
      setIsRideActive(false);
      setIsAnimating(false);
      setCurrentDistance(0); // Reset distance when ride ends
      setShowSummary(true); // Show summary when ride ends
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
      if (isRideActive) {
        // Only update distance if we get a new non-zero value
        if (data.distanceKm > currentDistance) {
          setCurrentDistance(data.distanceKm);
          setDistance(data.distanceKm); // Only update store distance when we have a new value
        }
        setTokens(data.tokens); // Only update tokens when ride is active
      }
      setElapsed(fmtTime(localElapsedSeconds));
    }
    if (isRideActive && data?.distanceKm === 0 && tokens !== 0) {
        // This condition might need refinement based on actual backend behavior for ended rides
        // Consider if backend signals ride truly ended or if it's just a reset to 0 for a new potential ride
        // If it means the workflow truly ended and we should lock things down:
        // setIsRideActive(false);
        // setIsAnimating(false);
    }
  }, [data, setDistance, setElapsed, isRideActive, tokens, setIsAnimating, localElapsedSeconds, currentDistance, setTokens]);

  // New effect to handle distance-based addDistance calls
  useEffect(() => {
    if (isRideActive && currentDistance > 0) {
      const currentMilestone = Math.floor(currentDistance / 100) * 100;
      if (currentMilestone > lastDistanceMilestoneRef.current) {
        lastDistanceMilestoneRef.current = currentMilestone;
        addDistanceMutation.mutate();
      }
    }
  }, [currentDistance, isRideActive, addDistanceMutation]);

  let rideStatusMessage = "Enter your email and unlock the scooter to start your ride.";
  if (start.isPending) {
    rideStatusMessage = "Unlocking scooter...";
  } else if (end.isPending) {
    rideStatusMessage = "Ending ride...";
  } else if (isRideActive) {
    rideStatusMessage = "Ride in progress.";
  } else if (tokens > 0) { // Assumes tokens > 0 means a ride has occurred
    rideStatusMessage = "Ride ended. Unlock scooter to start a new ride.";
  }

  /* --- UI -------------------------------------------------- */

  return (
    <div className="space-y-4 p-4">      
      {/* Show summary after ride ends */}
      {showSummary && !isRideActive && (
        <div className="border border-green-300 bg-green-50 rounded-lg p-4 mb-4 text-green-800 flex flex-col items-center animate-fade-in">
          <div className="flex items-center mb-2">
            <svg className="w-6 h-6 text-green-500 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <span className="font-bold text-lg">Ride Summary</span>
          </div>
          <div className="w-full space-y-1">
            <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
            <Stat label="Time" value={elapsed} />
            <Stat label="Cost (tokens)" value={tokens.toString()} />
          </div>
        </div>
      )}

      <p className="text-center text-sm text-gray-600">{rideStatusMessage}</p>

      {/* Show input and unlock button when not active and not pending */}
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

      {!isRideActive && !start.isPending && (
        <button
          className="btn btn-primary w-full"
          onClick={() => {
            if (email.trim() === '') {
              alert('Please enter an email address.'); // Basic validation
              return;
            }
            start.mutate();
          }}
          disabled={isRideActive || start.isPending || (tokens > 0 && !end.isSuccess && !isRideActive)}
        >
          {isRideActive ? 'Scooter Unlocked' : 'Unlock Scooter'}
        </button>
      )}

      {isRideActive && (
        <button
          className="btn btn-secondary w-full"
          onClick={() => end.mutate()}
          disabled={!isRideActive || end.isPending}
        >
          End Ride
        </button>
      )}

      {/* Only show stats outside summary if ride is active */}
      {!showSummary && (
        <div className="mt-6 space-y-1">
          <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
          <Stat label="Time" value={elapsed} />
          <Stat label="Cost (tokens)" value={tokens.toString()} />
        </div>
      )}
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
