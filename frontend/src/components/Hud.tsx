import { useRideStore } from '../stores/rideStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startRide, endRide, getRideState, addDistance as addDistanceApi } from '../api/rideApi';
import type { RideStateResponse } from '../api/rideApi';
import { useEffect, useState, useRef } from 'react';

/** Converts raw seconds → "hh:mm" */
const fmtTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

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
    setWorkflowId,
    setMovementDisabledMessage
  } = useRideStore();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [scooterId, setScooterId] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [scooterIdError, setScooterIdError] = useState('');
  const [isRideActive, setIsRideActive] = useState(false);
  const [localElapsedSeconds, setLocalElapsedSeconds] = useState(0);
  const lastBucketRef = useRef(0); // Tracks the last 100-ft bucket for addDistanceApi calls
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [showSummary, setShowSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const initializingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const summaryDismissedRef = useRef(false);

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

  // Function to show error message temporarily
  const showTemporaryError = (message: string) => {
    setErrorMessage(message);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage(null);
    }, 5000); // Message disappears after 5 seconds
  };

  // Cleanup error timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

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
      return startRide(scooterId, email);
    },
    onSuccess: (dataResponse) => {
      reset();
      setLocalElapsedSeconds(0);
      lastBucketRef.current = 0;
      setIsRideActive(true);
      const shouldAnimate = rideStateData?.status?.phase !== 'FAILED';
      setIsAnimating(shouldAnimate);
      setMovementDisabledMessage(null);
      setShowSummary(false);
      summaryDismissedRef.current = false;
      setWorkflowId(dataResponse.workflowId);
    },
    onError: (error: Error) => {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showTemporaryError('Unable to connect to the server. Please check if the API is running.');
      } else {
        showTemporaryError(error.message || 'Failed to start ride');
      }
      setIsAnimating(false);
      setMovementDisabledMessage('Unable to start ride. Please try again.');
    }
  });

  // Mutation to end a ride
  const end = useMutation({
    mutationFn: () => {
      if (!workflowId) throw new Error('No active workflow to end ride');
      return endRide(workflowId);
    },
    onSuccess: () => {
      setIsRideActive(false);
      setIsAnimating(false);
      setMovementDisabledMessage('Ride ended. Press "Unlock Scooter" to start a new ride.');
      setShowSummary(true);
    },
    onError: (error: Error) => {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showTemporaryError('Unable to connect to the server. Please check if the API is running.');
      } else {
        showTemporaryError(error.message || 'Failed to end ride');
      }
      setIsAnimating(false);
      setMovementDisabledMessage('Unable to end ride. Please try again.');
    }
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
      return addDistanceApi(workflowId);
    },
    onError: (error: Error) => {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showTemporaryError('Unable to connect to the server. Please check if the API is running.');
      }
    }
  });

  // Query to get ride state from the server
  const { data: rideStateData, isLoading: isLoadingRideState, error: rideStateError } = useQuery<RideStateResponse>({
    queryKey: ['rideState', workflowId],
    queryFn: async () => {
      if (!workflowId) throw new Error('No active workflow for getRideState');
      const response = await getRideState(workflowId);
      if (!response) {
        throw new Error('Unable to get ride status. Please try again.');
      }
      return response;
    },
    enabled: !!workflowId && isRideActive,
    refetchInterval: 500,
  });

  // Effect to handle INITIALIZING timeout
  useEffect(() => {
    if (rideStateData?.status?.phase === 'INITIALIZING' && isRideActive) {
      // Clear any existing timeout
      if (initializingTimeoutRef.current) {
        clearTimeout(initializingTimeoutRef.current);
      }
      // Set new timeout
      initializingTimeoutRef.current = setTimeout(() => {
        // Only set the message if we're not already showing a request timeout
        if (!isRequestTimedOut) {
          setErrorMessage('Your ride is taking longer than usual to start. Don\'t worry, your ride is active and we\'re working on getting your stats ready. Please try again in a moment.');
        }
      }, 3000);
    } else {
      // Clear timeout if not initializing
      if (initializingTimeoutRef.current) {
        clearTimeout(initializingTimeoutRef.current);
      }
      // Only clear the initializing message if we're not in INITIALIZING state anymore
      // and we're not showing a request timeout
      if (rideStateData?.status?.phase !== 'INITIALIZING' && !isRequestTimedOut) {
        setErrorMessage(null);
      }
    }

    return () => {
      if (initializingTimeoutRef.current) {
        clearTimeout(initializingTimeoutRef.current);
      }
    };
  }, [rideStateData?.status?.phase, isRideActive, isRequestTimedOut]);

  // Effect to handle request timeout
  useEffect(() => {
    if (isLoadingRideState && isRideActive) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        setIsRequestTimedOut(true);
        setErrorMessage('Taking longer than usual to get your ride status. Your ride is still active, but we can\'t show your current stats. Please try again in a moment.');
      }, 3000);
    } else {
      // Clear timeout if not loading
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Only clear the timeout message if we're not loading anymore
      if (!isLoadingRideState) {
        setIsRequestTimedOut(false);
        // Only clear the error message if we're not in INITIALIZING state
        if (rideStateData?.status?.phase !== 'INITIALIZING') {
          setErrorMessage(null);
        }
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoadingRideState, isRideActive, rideStateData?.status?.phase]);

  // Effect to handle ride state errors
  useEffect(() => {
    if (rideStateError) {
      const error = rideStateError as Error;
      if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        setErrorMessage('We\'re having trouble connecting to our servers. Your ride is still active, but we can\'t show your current stats. Please try again in a moment.');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setErrorMessage('Unable to connect to our servers. Your ride is still active, but we can\'t show your current stats. Please check your internet connection.');
      } else {
        setErrorMessage(error.message || 'Unable to get ride status. Please try again.');
      }
    } else {
      // Clear error message if there's no error and we're not in a timeout state
      if (!isRequestTimedOut && rideStateData?.status?.phase !== 'INITIALIZING') {
        setErrorMessage(null);
      }
    }
  }, [rideStateError, isRequestTimedOut, rideStateData?.status?.phase]);

  // Effect to process data from getRideState API poll
  useEffect(() => {
    if (rideStateData) {
      // Handle ENDED phase first
      if (rideStateData.status.phase === 'ENDED') {
        setIsRideActive(false);
        setIsAnimating(false);
        setShowSummary(true);
        setMovementDisabledMessage('Ride ended. Press "Unlock Scooter" to start a new ride.');
        return; // Exit early to prevent other state updates
      }

      // Update tokens from server data
      setTokens(rideStateData.status.tokens.total);

      // Update elapsed time in store using the local component timer
      setElapsed(fmtTime(localElapsedSeconds));

      // Update animation state based on ride phase
      const shouldAnimate = rideStateData.status.phase !== 'FAILED' && 
                           rideStateData.status.phase !== 'BLOCKED' &&
                           rideStateData.status.phase !== 'ENDED' as string;
      setIsAnimating(shouldAnimate);
      
      // Set appropriate movement disabled message based on ride state
      if (!shouldAnimate) {
        if (rideStateData.status.phase === 'BLOCKED') {
          setMovementDisabledMessage('Approve ride signal required to continue');
        } else if (rideStateData.status.lastError === 'ACCOUNT_NOT_FOUND') {
          setMovementDisabledMessage('Account not found. Please try a different email address.');
        } else if (rideStateData.status.phase === 'FAILED') {
          setMovementDisabledMessage('Ride failed. Please try again.');
        } else {
          setMovementDisabledMessage('Movement disabled. Please try again.');
        }
      } else {
        setMovementDisabledMessage(null);
      }
    }
  }, [rideStateData, setTokens, setElapsed, localElapsedSeconds, setIsAnimating, setMovementDisabledMessage]);

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
    rideStatusMessage = "Ride in progress. Use the right arrow key on your keyboard to move."; // Added hint for movement
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

      {/* Error Message Display */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Ride Summary: Shown when showSummary is true and ride is not active */}
      {showSummary && !isRideActive && (
        <div className="border border-green-300 bg-green-50 rounded-lg p-4 mb-4 text-green-800 flex flex-col items-center shadow-md animate-fade-in">
          {!rideStateData ? (
            <div className="text-center">
              <p>Loading ride summary...</p>
            </div>
          ) : (
            <div className="w-full space-y-2"> {/* Increased spacing */}
              <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
              <Stat label="Time" value={elapsed} />
              <Stat 
                label="Cost" 
                value={rideStateData?.status?.tokens?.total && rideStateData?.pricePerThousand && rideStateData?.currency 
                  ? `${rideStateData.currency} ${((rideStateData.status.tokens.total * rideStateData.pricePerThousand) / 1000).toFixed(2)}`
                  : 'Loading...'} 
              />
              {/* Token Breakdown Subsection */}
              <div className="mt-4 bg-green-100 border border-green-200 rounded-md p-3">
                <h4 className="text-sm font-semibold text-green-700 mb-2 text-center">Token Breakdown</h4>
                <div className="space-y-1">
                  <BreakdownStat 
                    label="Unlock fee" 
                    value={rideStateData?.status?.tokens?.unlock?.toString() ?? "0"} 
                  />
                  <BreakdownStat 
                    label="Ride time" 
                    value={rideStateData?.status?.tokens?.time?.toString() ?? "0"} 
                  />
                  <BreakdownStat 
                    label="Distance" 
                    value={rideStateData?.status?.tokens?.distance?.toString() ?? "0"} 
                  />
                  <div className="border-t border-green-200 my-2"></div>
                  <BreakdownStat 
                    label="Total" 
                    value={rideStateData?.status?.tokens?.total?.toString() ?? "0"} 
                    bold 
                  />
                  {/* Token to Dollar Calculation & Explanation */}
                  {rideStateData?.status?.tokens?.total && 
                   typeof rideStateData.pricePerThousand === 'number' && 
                   typeof rideStateData.currency === 'string' && (
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      {`${rideStateData.status.tokens.total} tokens × $${(rideStateData.pricePerThousand / 1000).toFixed(3)} = $${((rideStateData.status.tokens.total * rideStateData.pricePerThousand) / 1000).toFixed(2)}`}
                      <br />
                      {`1,000 tokens = $${rideStateData.pricePerThousand.toFixed(2)} (${rideStateData.currency})`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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

      {/* End Ride Button: Show if ride is active AND not failed */}
      {isRideActive && rideStateData?.status?.phase !== 'FAILED' && (
        <button
          className="w-full bg-rose-600 hover:bg-rose-700 text-gray-800 font-medium py-3 px-4 rounded-md shadow-md transition-all duration-200 hover:shadow-lg disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
          onClick={() => end.mutate()}
          disabled={!isRideActive || end.isPending}
        >
          End Ride
        </button>
      )}

      {/* Live Stats Display: Show if ride is active (and summary is not shown) */}
      {isRideActive && rideStateData?.status?.phase !== 'FAILED' && ( // Don't show stats if phase is FAILED
        <div className="mt-6 space-y-1 p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 text-center">Live Ride Stats</h3>
          <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
          <Stat label="Time" value={elapsed} />
          <Stat label="Cost" value={rideStateData ? `${rideStateData.currency} ${(rideStateData.status.tokens.total * rideStateData.pricePerThousand / 1000).toFixed(2)}` : 'Loading...'} />
          {/* --- Token Breakdown Subsection --- */}
          <div className="mt-4 bg-gray-50 border border-gray-100 rounded-md p-3">
            <h4 className="text-sm font-semibold text-gray-600 mb-2 text-center">Token Breakdown</h4>
            <div className="space-y-1">
              <BreakdownStat label="Unlock fee" value={rideStateData?.status.tokens.unlock.toString() ?? "0"} />
              <BreakdownStat label="Ride time" value={rideStateData?.status.tokens.time.toString() ?? "0"} />
              <BreakdownStat label="Distance" value={rideStateData?.status.tokens.distance.toString() ?? "0"} />
              <div className="border-t border-gray-200 my-2"></div>
              <BreakdownStat label="Total" value={rideStateData?.status.tokens.total.toString() ?? "0"} bold />
              {/* --- Token to Dollar Calculation & Explanation --- */}
              {rideStateData &&
                typeof rideStateData.pricePerThousand === 'number' &&
                typeof rideStateData.currency === 'string' && (
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    {`${rideStateData.status.tokens.total} tokens × $${(rideStateData.pricePerThousand / 1000).toFixed(3)} = $${((rideStateData.status.tokens.total * rideStateData.pricePerThousand) / 1000).toFixed(2)}`}
                    <br />
                    {`1,000 tokens = $${rideStateData.pricePerThousand.toFixed(2)} (${rideStateData.currency})`}
                  </div>
              )}
              {/* --- End Token to Dollar Calculation & Explanation --- */}
            </div>
          </div>
          {/* --- End Token Breakdown --- */}
          {isLoadingRideState && <p className="text-xs text-gray-400 text-center mt-2">Updating stats...</p>}
        </div>
      )}

      {/* Workflow Error Display */}
      {(() => {
        console.log('Debug rideStateData:', {
          phase: rideStateData?.status?.phase,
          isRideActive,
          lastError: rideStateData?.status?.lastError
        });
        return rideStateData?.status?.phase === 'FAILED' && (
          <div className="mt-6 border border-red-300 bg-red-50 rounded-lg p-4 mb-4 text-red-800 flex flex-col items-center shadow-md animate-fade-in">
            <div className="flex items-center mb-3">
              <svg className="w-7 h-7 text-red-500 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-bold text-xl">Unable to Start Ride</span>
            </div>
            <div className="w-full space-y-4">
              <p className="text-center text-red-700">
                {rideStateData.status.lastError === 'ACCOUNT_NOT_FOUND'
                  ? 'We couldn\'t find an account with that email address.'
                  : 'There was a problem starting your ride: Invalid email address.'}
              </p>
              
              {/* Email Input for Retry */}
              <div className="space-y-1">
                <input
                  type="email"
                  placeholder="Try another email address"
                  className="input input-bordered w-full p-3 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-800"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !start.isPending) {
                      if (validateEmail(email)) {
                        start.mutate();
                      }
                    }
                  }}
                />
                {emailError && (
                  <p className="text-red-500 text-sm mt-1">{emailError}</p>
                )}
              </div>

              {/* Retry Button */}
              <button
                className="w-full bg-red-600 hover:bg-red-700 text-gray-800 font-medium py-3 px-4 rounded-md shadow-md transition-all duration-200 hover:shadow-lg disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
                onClick={() => {
                  if (validateEmail(email)) {
                    start.mutate();
                  }
                }}
                disabled={start.isPending}
              >
                Try Again
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Stat component for displaying key-value pairs
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 px-1 border-b border-gray-100 last:border-b-0">
      <span className="text-gray-700 font-sans text-base font-medium tracking-tight">{label}</span>
      <span className="text-gray-900 font-mono text-lg font-bold tracking-wider">{value}</span>
    </div>
  );
}

// Add BreakdownStat component for token breakdown
function BreakdownStat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-gray-600 text-sm ${bold ? 'font-bold' : ''}`}>{label}</span>
      <span className={`text-gray-900 font-mono text-base ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}
