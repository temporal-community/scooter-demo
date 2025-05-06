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
  distanceFt: number;
  elapsedSeconds: number; // Assuming API might also return this, though local timer is used for display
  tokens: number;
}

export default function Hud() {
  const {
    distance, // This is from useRideStore, now primarily driven by client-side simulation
    elapsed,
    tokens,
    reset,      // Assumed to reset store: distance, tokens, elapsed
    setElapsed, // To store formatted localElapsedSeconds
    setTokens,  // To store tokens from API
    setIsAnimating, // This toggle is crucial for client-side distance accumulation
    workflowId,
    setWorkflowId
  } = useRideStore();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [scooterId, setScooterId] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [scooterIdError, setScooterIdError] = useState('');
  const [isRideActive, setIsRideActive] = useState(false);
  const [localElapsedSeconds, setLocalElapsedSeconds] = useState(0);
  // Local state to store the distance reported by the server, for reference or future reconciliation
  const [serverReportedDistanceFt, setServerReportedDistanceFt] = useState(0);
  const lastBucketRef = useRef(0); // Tracks the last 100-ft bucket for addDistanceApi calls
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [showSummary, setShowSummary] = useState(false);

  // Timer effect for localElapsedSeconds
  useEffect(() => {
    if (isRideActive) {
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
  }, [isRideActive]);

  // Add email validation function
  const validateEmail = (email: string): boolean => {
    if (!email.trim()) {
      setEmailError('Please enter an email address');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  // Add scooter ID validation function
  const validateScooterId = (id: string): boolean => {
    if (!id.trim()) {
      setScooterIdError('Please enter a scooter ID');
      return false;
    }
    setScooterIdError('');
    return true;
  };

  // Mutation to start a ride
  const start = useMutation({
    mutationFn: async () => {
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }
      if (!validateScooterId(scooterId)) {
        throw new Error('Invalid scooter ID');
      }
      console.log('Starting ride for email:', email, 'scooter:', scooterId);
      return startRide(scooterId);
    },
    onSuccess: (dataResponse) => { // Renamed 'data' to 'dataResponse'
      reset(); // CRITICAL: Resets distance, tokens, elapsed in store to 0/"00:00"
      setLocalElapsedSeconds(0);
      setServerReportedDistanceFt(0); // Reset server distance cache
      lastBucketRef.current = 0;
      setIsRideActive(true);
      // CRITICAL: setIsAnimating(true) should trigger the client-side mechanism
      // (e.g., in useRideStore or via event listeners) that starts incrementing
      // the 'distance' in useRideStore based on user actions (e.g., holding arrow key).
      setIsAnimating(true);
      setShowSummary(false);
      setWorkflowId(dataResponse.workflowId);
    },
    // onError: (error) => { console.error("Failed to start ride:", error); }
  });

  // Mutation to end a ride
  const end = useMutation({
    mutationFn: () => {
      if (!workflowId) throw new Error('No active workflow to end ride');
      return endRide(workflowId);
    },
    onSuccess: () => {
      setIsRideActive(false);
      // CRITICAL: setIsAnimating(false) should stop the client-side distance accumulation.
      setIsAnimating(false);
      // localElapsedSeconds will stop via its own effect.
      // The 'distance' in the store will hold its final value for the summary.
      setShowSummary(true);
    },
    // onError: (error) => { console.error("Failed to end ride:", error); }
  });

  // Effect to clean up workflowId when summary is dismissed and ride is not active
  useEffect(() => {
    if (!showSummary && !isRideActive) {
      setWorkflowId(null);
    }
  }, [showSummary, isRideActive, setWorkflowId]);

  // Mutation to report distance increments to the API
  const addDistanceMutation = useMutation({
    mutationFn: () => {
      if (!workflowId) throw new Error('No active workflow for addDistance');
      console.log('Calling addDistanceApi via mutation for workflow:', workflowId);
      return addDistanceApi(workflowId); // API call
    },
    // onSuccess: () => { console.log("addDistanceApi call successful"); },
    // onError: (error) => { console.error("addDistanceApi call failed:", error); }
  });

  // Query to get ride state from the server (e.g., tokens, server's view of distance)
  const { data: rideStateData, isLoading: isLoadingRideState } = useQuery<RideStateResponse>({
    queryKey: ['rideState', workflowId],
    queryFn: () => {
      if (!workflowId) throw new Error('No active workflow for getRideState');
      return getRideState(workflowId);
    },
    enabled: !!workflowId && isRideActive, // Only fetch if there's a workflowId and ride is active
    refetchInterval: 2000, // Polling interval (e.g., 2 seconds)
  });

  // Effect to process data from getRideState API poll
  useEffect(() => {
    if (rideStateData) {
      // Update tokens from server data
      setTokens(rideStateData.tokens);
      // Update our local cache of the server's reported distance
      setServerReportedDistanceFt(rideStateData.distanceFt);

      // IMPORTANT: We are NOT calling setDistance(rideStateData.distanceFt) here.
      // The 'distance' in useRideStore is primarily driven by client-side simulation
      // (controlled by 'isAnimating' and user input).
      // rideStateData.distanceFt can be used for reconciliation if needed, but not for direct override here.
    }
    // Update elapsed time in store using the local component timer
    // This ensures the timer display is smooth and driven by the client.
    setElapsed(fmtTime(localElapsedSeconds));

  }, [rideStateData, setTokens, setElapsed, localElapsedSeconds, setServerReportedDistanceFt]);


  // Effect to call addDistanceApi when 100-ft boundaries are crossed
  // This now relies on 'distance' from useRideStore, which is updated by client simulation.
  useEffect(() => {
    if (!isRideActive || distance <= 0) {
      // If ride ends or distance is zero, ensure bucket is reset for the next ride.
      // This might be redundant if lastBucketRef.current is reset in start.onSuccess, but safe.
      if (distance === 0) {
          lastBucketRef.current = 0;
      }
      return;
    }

    const currentBucket = Math.floor(distance / 100);
    const previousBucket = lastBucketRef.current;

    if (currentBucket > previousBucket) {
      console.log(`Hud: Store distance ${distance}ft. Current bucket ${currentBucket}, previous bucket ${previousBucket}.`);
      // Call mutate for each bucket crossed since the last update.
      for (let i = previousBucket + 1; i <= currentBucket; i++) {
        console.log(`Hud: Mutating addDistance for bucket ${i}.`);
        addDistanceMutation.mutate();
      }
      lastBucketRef.current = currentBucket;
    }
  }, [distance, isRideActive, addDistanceMutation]); // Depends on store's distance and ride state

  // Determine ride status message
  let rideStatusMessage = "Enter your email and unlock the scooter to start your ride.";
  if (start.isPending) {
    rideStatusMessage = "Unlocking scooter...";
  } else if (end.isPending) {
    rideStatusMessage = "Ending ride...";
  } else if (isRideActive) {
    rideStatusMessage = "Ride in progress. Use controls to move."; // Added hint for movement
  } else if (showSummary) { // Check showSummary for post-ride message
    rideStatusMessage = "Ride ended.";
  } else if (workflowId && tokens > 0 && !isRideActive) { // Condition for a previous ride summary shown, now ready for new.
     rideStatusMessage = "Previous ride ended. Unlock scooter to start a new ride.";
  }


  /* --- UI -------------------------------------------------- */
  return (
    <div className="space-y-4 p-4 max-w-md mx-auto font-sans"> {/* Added max-width and centering for better layout */}

      {workflowId && (
        <p className="text-center text-xs text-gray-500 font-mono break-all"> {/* Added break-all for long IDs */}
          Workflow: {workflowId}
        </p>
      )}

      {/* Ride Summary: Shown when showSummary is true and ride is not active */}
      {showSummary && !isRideActive && (
        <div className="border border-green-300 bg-green-50 rounded-lg p-4 mb-4 text-green-800 flex flex-col items-center shadow-md animate-fade-in">
          <div className="flex items-center mb-3"> {/* Increased margin-bottom */}
            <svg className="w-7 h-7 text-green-500 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <span className="font-bold text-xl">Ride Summary</span> {/* Increased text size */}
          </div>
          <div className="w-full space-y-2"> {/* Increased spacing */}
            <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
            <Stat label="Time" value={elapsed} />
            <Stat label="Cost (tokens)" value={tokens.toString()} />
          </div>
           <button
            onClick={() => setShowSummary(false)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-gray-800 rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            Dismiss Summary
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-center text-sm text-gray-600 min-h-[20px]">{rideStatusMessage}</p> {/* Added min-height */}
      </div>

      {/* Scooter ID Input: Show if not active, not starting, and summary isn't demanding full attention */}
      {!isRideActive && !start.isPending && !showSummary && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label htmlFor="scooterId" className="text-sm text-gray-600 whitespace-nowrap">Scooter ID:</label>
            <input
              id="scooterId"
              type="text"
              placeholder="e.g. 5555"
              className={`input input-bordered w-full p-3 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 ${
                scooterIdError ? 'border-red-500' : ''
              }`}
              value={scooterId}
              onChange={(e) => {
                setScooterId(e.target.value);
                setScooterIdError(''); // Clear error when user types
              }}
              disabled={isRideActive || start.isPending}
            />
          </div>
          {scooterIdError && (
            <p className="text-red-500 text-sm mt-1">{scooterIdError}</p>
          )}
        </div>
      )}

      {/* Email Input: Show if not active, not starting, and summary isn't demanding full attention */}
      {!isRideActive && !start.isPending && !showSummary && (
        <div className="space-y-1">
          <input
            type="email"
            placeholder="maria@example.com"
            className={`input input-bordered w-full p-3 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 ${
              emailError ? 'border-red-500' : ''
            }`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(''); // Clear error when user types
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isRideActive && !start.isPending && !showSummary) {
                if (validateEmail(email)) {
                  start.mutate();
                }
              }
            }}
            disabled={isRideActive || start.isPending}
          />
          {emailError && (
            <p className="text-red-500 text-sm mt-1">{emailError}</p>
          )}
        </div>
      )}

      {/* Unlock Scooter Button: Show if not active, not starting, and summary isn't demanding full attention */}
      {!isRideActive && !start.isPending && !showSummary && (
        <button
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-gray-800 font-medium py-3 px-4 rounded-md shadow-md transition-all duration-200 hover:shadow-lg disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
          onClick={() => {
            if (!validateEmail(email)) {
              return;
            }
            start.mutate();
          }}
          disabled={isRideActive || start.isPending}
        >
          Unlock Scooter
        </button>
      )}

      {/* End Ride Button: Show if ride is active */}
      {isRideActive && (
        <button
          className="w-full bg-rose-600 hover:bg-rose-700 text-gray-800 font-medium py-3 px-4 rounded-md shadow-md transition-all duration-200 hover:shadow-lg disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
          onClick={() => end.mutate()}
          disabled={!isRideActive || end.isPending}
        >
          End Ride
        </button>
      )}

      {/* Live Stats Display: Show if ride is active (and summary is not shown) */}
      {isRideActive && ( // Simplified condition: only show if ride is active
        <div className="mt-6 space-y-1 p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 text-center">Live Ride Stats</h3>
          <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
          <Stat label="Time" value={elapsed} />
          <Stat label="Cost (tokens)" value={tokens.toString()} />
          {isLoadingRideState && <p className="text-xs text-gray-400 text-center mt-2">Updating stats...</p>}
        </div>
      )}
    </div>
  );
}

// Stat component for displaying key-value pairs
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 px-1 border-b border-gray-100 last:border-b-0"> {/* Added padding and border */}
      <span className="text-gray-600 text-sm">{label}</span>
      <span className="font-mono text-gray-800 font-semibold text-sm">{value}</span>
    </div>
  );
}
