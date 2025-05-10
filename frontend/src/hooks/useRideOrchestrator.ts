// frontend/src/hooks/useRideOrchestrator.ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRideStore } from '../stores/rideStore';
import { useRideTimer } from './useRideTimer';
import { useRideMutations } from './useRideMutations';
import { useRideStatePoller } from './useRideStatePoller';
import { fmtTime, calculateElapsedSeconds } from '../utils/timeUtils';
import { validateEmail as validateEmailUtil, validateScooterId as validateScooterIdUtil } from '../utils/validationUtils';
import type { NavigateFunction } from 'react-router-dom';
// import type { RideStateResponse } from '../api/rideApi'; // Assuming this type might need adjustment elsewhere

const ACTIVE_PHASES = ['INITIALIZING', 'ACTIVE', 'BLOCKED'] as const;
type ActivePhase = typeof ACTIVE_PHASES[number];

const isActivePhase = (phase: string): phase is ActivePhase => {
  return ACTIVE_PHASES.includes(phase as ActivePhase);
};

// Helper for consistent log timestamps
const logTs = (message: string, ...args: any[]) => {
  // This helper prepends a timestamp to each console log for easier debugging.
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
};


export const useRideOrchestrator = (
  workflowIdFromUrl?: string | null,
  navigate?: NavigateFunction
) => {
  // Log hook initialization with incoming parameters
  logTs('[useRideOrchestrator] Hook initialized.', { workflowIdFromUrl });

  // Destructure state and setters from Zustand store
  const {
    distance: storeDistance,
    elapsed: storeElapsed,
    tokens: storeTokens,
    reset: storeReset,
    setElapsed: storeSetElapsed,
    setTokens: storeSetTokens,
    setIsAnimating: storeSetIsAnimating,
    workflowId: storeWorkflowId,
    setWorkflowId: storeSetWorkflowId,
    setMovementDisabledMessage: storeSetMovementDisabledMessage,
  } = useRideStore();

  // State for email input and validation
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  // State for scooter ID input and validation, with a random initial value
  const [scooterId, setScooterId] = useState(() => {
    const randomId = Math.floor(1000 + Math.random() * 9000).toString();
    logTs(`[useState scooterId] Initial random scooterId: ${randomId}`);
    return randomId;
  });
  const [scooterIdError, setScooterIdError] = useState('');
  
  // Internal state for managing the current workflow ID
  const [internalWorkflowId, setInternalWorkflowId] = useState<string | null>(
    workflowIdFromUrl || storeWorkflowId
  );
  // State to track if the ride is in an active phase (INITIALIZING, ACTIVE, BLOCKED)
  const [isRideActiveState, setIsRideActiveState] = useState(false);
  // State to store the server-provided start time of the ride
  const [rideStartTime, setRideStartTime] = useState<number | null>(null);

  // State to control visibility of the ride summary
  const [showSummary, setShowSummary] = useState(false);
  // State for displaying temporary error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // State to track if an API request (specifically initialization) has timed out
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false); 
  // State to store the timestamp when the 'INITIALIZING' phase began
  const [initializingStartTime, setInitializingStartTime] = useState<number | null>(null);
  // Constant defining the timeout duration for the 'INITIALIZING' state before showing an error
  const INITIALIZING_TIMEOUT_MS = 3000; // 3 seconds
  // Interval for checking the initialization timeout (e.g., every 500ms)
  const INITIALIZING_CHECK_INTERVAL_MS = 500;


  // Refs for managing various aspects of the ride lifecycle
  const lastBucketRef = useRef(0); // Tracks distance buckets for mutations
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined); // Timeout for clearing error messages
  const endingRef = useRef(false); // Flag to indicate if the ride ending process is in progress

  // Refs for managing state related to dismissing the summary and URL synchronization
  const previousWorkflowIdOnDismissRef = useRef<string | null | undefined>(null);
  const justDismissedFlagRef = useRef(false);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Custom hook to manage the elapsed time timer
  const localElapsedSeconds = useRideTimer(isRideActiveState, rideStartTime);

  // Callback to show a temporary error message for 5 seconds
  const showTemporaryError = useCallback((message: string) => {
    logTs(`[showTemporaryError] Called. Current errorMessage: "${errorMessage}". New message: "${message}"`);
    setErrorMessage(message); // Set the new error message
    logTs(`[showTemporaryError] setErrorMessage called with: "${message}"`);
    if (errorTimeoutRef.current) {
      logTs('[showTemporaryError] Clearing existing error timeout ref:', errorTimeoutRef.current);
      clearTimeout(errorTimeoutRef.current); // Clear any existing timeout
    }
    // Set a new timeout to clear the error message after 5 seconds
    errorTimeoutRef.current = setTimeout(() => {
      logTs(`[showTemporaryError] 5s TIMEOUT FIRED. Clearing errorMessage. Message was: "${message}"`);
      setErrorMessage(null); // Clear the error message
      logTs(`[showTemporaryError] setErrorMessage called with null after 5s timeout.`);
    }, 5000);
    logTs('[showTemporaryError] New error timeout ref set:', errorTimeoutRef.current);
  }, [errorMessage]); // Dependency: errorMessage (to log current value), setErrorMessage is stable.

  // Custom hook for handling ride mutations (start, end, addDistance)
  const { 
    startMutation, 
    endMutation, 
    addDistanceMutation 
  } = useRideMutations({
    workflowId: internalWorkflowId,
    validateEmailFn: validateEmailUtil,
    validateScooterIdFn: validateScooterIdUtil,
    onStartSuccess: (dataResponse) => {
      logTs('[onStartSuccess] Ride started successfully.', dataResponse);
      storeReset(); // Reset Zustand store
      lastBucketRef.current = 0; // Reset distance bucket
      const startTimeFromServer = dataResponse.status?.startedAt ? new Date(dataResponse.status.startedAt).getTime() : Date.now();
      setRideStartTime(startTimeFromServer);
      setIsRideActiveState(true); // Set active immediately
      storeSetIsAnimating(true);
      storeSetMovementDisabledMessage(null);
      setShowSummary(false); 
      setInternalWorkflowId(dataResponse.workflowId);
      storeSetWorkflowId(dataResponse.workflowId); // Sync with Zustand store
      if (navigate) {
        navigate(`/ride/${dataResponse.workflowId}`, { replace: true }); // Navigate to ride page
      }
    },
    onStartError: (error: Error) => {
      logTs('[onStartError] Failed to start ride.', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showTemporaryError('Unable to connect to the server. Please check if the API is running.');
      } else {
        showTemporaryError(error.message || 'Failed to start ride');
      }
      storeSetIsAnimating(false);
      storeSetMovementDisabledMessage('Unable to start ride. Please try again.');
      setShowSummary(false); 
    },
    onEndMutate: () => {
      logTs('[onEndMutate] Ending ride mutation started.');
      endingRef.current = true;
      setIsRideActiveState(false); 
      storeSetIsAnimating(false);
    },
    onEndSuccess: () => {
      logTs('[onEndSuccess] Ride end signal successful for workflow:', internalWorkflowId);
      endingRef.current = false;
    },
    onEndError: (error: Error) => {
      logTs('[onEndError] Failed to end ride.', error);
      endingRef.current = false;
      showTemporaryError(error.message || 'Failed to end ride');
      setShowSummary(false); 
    },
    onAddDistanceError: (error: Error) => {
      logTs('[onAddDistanceError] Failed to add distance.', error);
      showTemporaryError(error.message || 'Failed to add distance');
    },
  });
  
  // Memoized value to determine if the ride state poller should be active
  const pollerEnabled = useMemo(() => {
    const enabled = internalWorkflowId !== null && ( 
      isRideActiveState || 
      (!startMutation.isPending && !endMutation.isPending && !showSummary) 
    );
    logTs(`[pollerEnabled useMemo] internalWorkflowId: ${internalWorkflowId}, isRideActiveState: ${isRideActiveState}, startPending: ${startMutation.isPending}, endPending: ${endMutation.isPending}, showSummary: ${showSummary}. Poller enabled: ${enabled}`);
    return enabled;
  }, [internalWorkflowId, isRideActiveState, startMutation.isPending, endMutation.isPending, showSummary]);

  // Custom hook for polling ride state
  const { 
    data: rideStateData, 
    isLoading: isLoadingRideState, 
    refetch: refetchRideState
  } = useRideStatePoller(internalWorkflowId, pollerEnabled);

  // Effect to update the elapsed time in the Zustand store whenever localElapsedSeconds changes
  useEffect(() => {
    logTs(`[useEffect localElapsedSeconds] Updating storeElapsed. localElapsedSeconds: ${localElapsedSeconds}, fmtTime: ${fmtTime(localElapsedSeconds)}`);
    storeSetElapsed(fmtTime(localElapsedSeconds));
  }, [localElapsedSeconds, storeSetElapsed]);

  // Main effect to process data from the poller (rideStateData)
  useEffect(() => {
    // Corrected log statement to avoid TypeScript error by logging the whole rideStateData object.
    logTs(`[useEffect rideStateData] START. internalWorkflowId: ${internalWorkflowId}, fullRideStateData:`, rideStateData);

    if (!internalWorkflowId) {
      logTs(`[useEffect rideStateData] No internalWorkflowId. Current showSummary: ${showSummary}, isRideActiveState: ${isRideActiveState}. Setting showSummary to false.`);
      if (showSummary) setShowSummary(false);
      // isRideActiveState will be managed by internalWorkflowId changes or explicit sets.
      logTs(`[useEffect rideStateData] END (no internalWorkflowId).`);
      return; 
    }

    if (rideStateData && rideStateData.status) {
      const serverPhase = rideStateData.status.phase;
      logTs(`[useEffect rideStateData] Processing rideStateData. WorkflowId: ${internalWorkflowId}, ServerPhase: ${serverPhase}, Tokens: ${rideStateData.status.tokens?.total || 0}`);
      logTs(`[useEffect rideStateData] Current state before processing: initializingStartTime: ${initializingStartTime}, isRequestTimedOut: ${isRequestTimedOut}, errorMessage: "${errorMessage}"`);
      
      const isActiveFromServer = isActivePhase(serverPhase); 
      const isInitializing = serverPhase === 'INITIALIZING';
      const isFailed = serverPhase === 'FAILED';
      const isEnded = serverPhase === 'ENDED';

      logTs(`[useEffect rideStateData] Phase flags: isActiveFromServer: ${isActiveFromServer}, isInitializing: ${isInitializing}, isFailed: ${isFailed}, isEnded: ${isEnded}`);

      // Set initializingStartTime when phase first becomes INITIALIZING
      if (isInitializing && !initializingStartTime) {
        const now = Date.now();
        logTs(`[useEffect rideStateData] Phase is INITIALIZING and initializingStartTime is NULL. Setting to current time: ${now}`);
        setInitializingStartTime(now);
      } else if (!isInitializing && initializingStartTime) {
        // Clear initializingStartTime if no longer initializing
        logTs(`[useEffect rideStateData] Phase is NOT INITIALIZING (${serverPhase}) but initializingStartTime was SET (${initializingStartTime}). Clearing it.`);
        setInitializingStartTime(null);
        // Also reset isRequestTimedOut if we are moving out of INITIALIZING and the ride didn't fail
        if (!isFailed && isRequestTimedOut) {
          logTs(`[useEffect rideStateData] Phase is not FAILED. Resetting isRequestTimedOut (was true) to FALSE.`);
          setIsRequestTimedOut(false);
        }
      }
      
      logTs(`[useEffect rideStateData] Setting isRideActiveState to: ${isActiveFromServer}. Current: ${isRideActiveState}`);
      if (isRideActiveState !== isActiveFromServer) setIsRideActiveState(isActiveFromServer);
      
      logTs(`[useEffect rideStateData] Setting storeSetIsAnimating to: ${isActiveFromServer && !isInitializing}.`);
      storeSetIsAnimating(isActiveFromServer && !isInitializing); 

      if (isActiveFromServer && rideStateData.status.startedAt) {
        const serverStartTimeMs = new Date(rideStateData.status.startedAt).getTime();
        if (rideStartTime !== serverStartTimeMs) {
          setRideStartTime(serverStartTimeMs);
        }
      } else if (!isActiveFromServer && rideStartTime !== null) {
        setRideStartTime(null);
      }
      
      if (isEnded) {
        if (internalWorkflowId && !showSummary) setShowSummary(true);
        const finalElapsedSeconds = calculateElapsedSeconds(rideStateData.status.startedAt, rideStateData.status.endedAt);
        storeSetElapsed(fmtTime(finalElapsedSeconds));
      } else if (isFailed) {
        if (showSummary) setShowSummary(false);
        // Reset isRequestTimedOut if it was true due to initialization timeout, but now the ride has failed.
        // The failure itself is the primary error state.
        if (isRequestTimedOut) {
            logTs(`[useEffect rideStateData] Ride FAILED, resetting isRequestTimedOut (was true) to FALSE as failure takes precedence.`);
            setIsRequestTimedOut(false);
        }
        let finalElapsedSeconds = 0;
        if (rideStateData.status.startedAt && rideStateData.status.endedAt) {
             finalElapsedSeconds = calculateElapsedSeconds(rideStateData.status.startedAt, rideStateData.status.endedAt);
        } else if (rideStateData.status.startedAt) {
            finalElapsedSeconds = calculateElapsedSeconds(rideStateData.status.startedAt, undefined);
        }
        storeSetElapsed(fmtTime(finalElapsedSeconds));
      } else { 
        if (showSummary) setShowSummary(false);
      }
      
      storeSetTokens(rideStateData.status.tokens?.total || 0);
      storeSetMovementDisabledMessage(rideStateData.status.lastError || null);

    } else {
      logTs(`[useEffect rideStateData] No rideStateData or no rideStateData.status. internalWorkflowId: ${internalWorkflowId}`);
    }
    logTs(`[useEffect rideStateData] END. Final states for this run: initializingStartTime: ${initializingStartTime}, isRequestTimedOut: ${isRequestTimedOut}, errorMessage: "${errorMessage}", showSummary: ${showSummary}, isRideActiveState: ${isRideActiveState}`);
  }, [
    internalWorkflowId, rideStateData, 
    storeSetTokens, storeSetElapsed, storeSetMovementDisabledMessage, storeSetIsAnimating, 
    rideStartTime, initializingStartTime, isRequestTimedOut, errorMessage, 
    setRideStartTime, setIsRideActiveState, setShowSummary,
    setInitializingStartTime, setIsRequestTimedOut, 
    showTemporaryError, 
  ]);

  // Dedicated effect for INITIALIZING timeout check using an interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined = undefined;
    // Check if current phase from rideStateData is INITIALIZING
    const currentPhaseIsInitializing = rideStateData?.status?.phase === 'INITIALIZING';

    logTs(`[useEffect InitializingInterval] START. currentPhaseIsInitializing: ${currentPhaseIsInitializing}, initializingStartTime: ${initializingStartTime}, isRequestTimedOut: ${isRequestTimedOut}`);

    if (currentPhaseIsInitializing && initializingStartTime && !isRequestTimedOut) {
      logTs(`[useEffect InitializingInterval] Conditions met. Setting up interval.`);
      intervalId = setInterval(() => {
        // isRequestTimedOut is read from the closure of this setInterval callback.
        // For it to have the latest value if it changes, isRequestTimedOut needs to be in the
        // dependency array of the outer useEffect, which it is.
        if (!isRequestTimedOut) { 
            const elapsedTime = Date.now() - initializingStartTime;
            logTs(`[useEffect InitializingInterval] Interval TICK. elapsedTime: ${elapsedTime}ms. isRequestTimedOut (from closure): ${isRequestTimedOut}`);
            if (elapsedTime > INITIALIZING_TIMEOUT_MS) {
              logTs(`[useEffect InitializingInterval] TIMEOUT DETECTED in interval. elapsedTime: ${elapsedTime}. Showing error.`);
              showTemporaryError('Ride initialization is taking too long. Please try again.');
              setIsRequestTimedOut(true); // This will cause the outer useEffect to re-run and clear the interval.
            }
        } else {
           // This branch will be taken if isRequestTimedOut became true from elsewhere, or after setIsRequestTimedOut(true) above.
           logTs(`[useEffect InitializingInterval] Interval TICK but isRequestTimedOut (from closure) is already true. Clearing interval.`);
           if (intervalId) clearInterval(intervalId);
        }
      }, INITIALIZING_CHECK_INTERVAL_MS); // Check periodically
    } else {
      logTs(`[useEffect InitializingInterval] Conditions NOT met. Interval will not be set or will be cleared by cleanup.`);
    }

    return () => {
      if (intervalId) {
        logTs(`[useEffect InitializingInterval] CLEANUP. Clearing intervalId: ${intervalId}`);
        clearInterval(intervalId);
      } else {
        logTs(`[useEffect InitializingInterval] CLEANUP. No active interval to clear.`);
      }
    };
  }, [rideStateData?.status?.phase, initializingStartTime, isRequestTimedOut, showTemporaryError, setIsRequestTimedOut, INITIALIZING_TIMEOUT_MS, INITIALIZING_CHECK_INTERVAL_MS]);


  // Effect to reset ride-specific timers and flags when internalWorkflowId changes
  useEffect(() => {
    logTs(`[useEffect internalWorkflowId change] START. internalWorkflowId: ${internalWorkflowId}. Resetting rideStartTime, initializingStartTime, isRequestTimedOut, errorMessage.`);
    setRideStartTime(null); 
    setInitializingStartTime(null); 
    setIsRequestTimedOut(false); 
    setErrorMessage(null); // Also clear any lingering error messages
    if (errorTimeoutRef.current) { // Clear pending error timeout
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = undefined;
    }
    logTs(`[useEffect internalWorkflowId change] END. rideStartTime: null, initializingStartTime: null, isRequestTimedOut: false, errorMessage: null.`);
  }, [internalWorkflowId]); 

  // Effect to synchronize with workflowId from URL parameters
  useEffect(() => {
    logTs(`[useEffect workflowIdFromUrl] START. workflowIdFromUrl: ${workflowIdFromUrl}, internalWorkflowId: ${internalWorkflowId}, startPending: ${startMutation.isPending}, justDismissed: ${justDismissedFlagRef.current}`);

    if (workflowIdFromUrl) { 
      if (justDismissedFlagRef.current && workflowIdFromUrl === previousWorkflowIdOnDismissRef.current) {
        logTs(`[useEffect workflowIdFromUrl] Ignoring stale workflowIdFromUrl (${workflowIdFromUrl}) immediately after dismissal.`);
        return; 
      }
      if (workflowIdFromUrl !== internalWorkflowId) {
        logTs(`[useEffect workflowIdFromUrl] URL has workflowId ${workflowIdFromUrl}, current internal is ${internalWorkflowId}. Resetting and loading from URL.`);
        storeReset(); 
        setEmail(''); 
        setInternalWorkflowId(workflowIdFromUrl); 
        storeSetWorkflowId(workflowIdFromUrl); 
        refetchRideState(); 
        if (justDismissedFlagRef.current) {
            justDismissedFlagRef.current = false;
            previousWorkflowIdOnDismissRef.current = null;
            if(dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
            logTs(`[useEffect workflowIdFromUrl] Cleared dismissal flags.`);
        }
      }
    } else { // No workflowId in URL
      if (internalWorkflowId && !justDismissedFlagRef.current && !startMutation.isPending) {
        logTs(`[useEffect workflowIdFromUrl] URL cleared, internalWorkflowId (${internalWorkflowId}) was set. Conditions met for reset (not pending start). Resetting internal state.`);
        storeReset(); 
        setInternalWorkflowId(null); 
        storeSetWorkflowId(null); 
      } else {
        logTs(`[useEffect workflowIdFromUrl] URL cleared, but conditions for reset not met. internalWorkflowId: ${internalWorkflowId}, justDismissed: ${justDismissedFlagRef.current}, startPending: ${startMutation.isPending}`);
      }
    }
    logTs(`[useEffect workflowIdFromUrl] END.`);
  }, [
      workflowIdFromUrl, 
      internalWorkflowId, 
      storeReset, 
      storeSetWorkflowId, 
      refetchRideState,
      setInternalWorkflowId, 
      startMutation.isPending, 
  ]);

  // Effect to synchronize with workflowId from the Zustand store
  useEffect(() => {
    logTs(`[useEffect storeWorkflowId] START. storeWorkflowId: ${storeWorkflowId}, internalWorkflowId: ${internalWorkflowId}`);
    if (storeWorkflowId && storeWorkflowId !== internalWorkflowId) {
      logTs(`[useEffect storeWorkflowId] storeWorkflowId (${storeWorkflowId}) changed and differs from internal (${internalWorkflowId}). Syncing internal.`);
      setInternalWorkflowId(storeWorkflowId); 
    } else if (!storeWorkflowId && internalWorkflowId && !startMutation.isPending) { 
      logTs(`[useEffect storeWorkflowId] storeWorkflowId cleared, but internalWorkflowId (${internalWorkflowId}) was set and not pending start. Resetting.`);
      storeReset(); 
      setInternalWorkflowId(null); 
    }
    logTs(`[useEffect storeWorkflowId] END.`);
  }, [storeWorkflowId, internalWorkflowId, storeReset, setInternalWorkflowId, startMutation.isPending]);

  // Effect for sending distance updates
  useEffect(() => {
    logTs(`[useEffect addDistance] START. isRideActiveState: ${isRideActiveState}, storeDistance: ${storeDistance}, internalWorkflowId: ${internalWorkflowId}, lastBucketRef.current: ${lastBucketRef.current}`);
    if (!isRideActiveState || storeDistance <= 0 || !internalWorkflowId) {
      if (storeDistance === 0) {
        lastBucketRef.current = 0; 
      }
      logTs(`[useEffect addDistance] END (conditions not met).`);
      return;
    }
    const currentBucket = Math.floor(storeDistance / 100);
    const previousBucket = lastBucketRef.current;
    if (currentBucket > previousBucket) {
      logTs(`[useEffect addDistance] Mutating for buckets ${previousBucket + 1} to ${currentBucket}.`);
      for (let i = previousBucket + 1; i <= currentBucket; i++) {
        addDistanceMutation.mutate();
      }
      lastBucketRef.current = currentBucket; 
    }
    logTs(`[useEffect addDistance] END.`);
  }, [storeDistance, isRideActiveState, addDistanceMutation, internalWorkflowId]);
  
  // Callback to dismiss the ride summary and reset all ride-related state
  const dismissSummaryAndReset = useCallback((forceResetDueToError = false) => {
    logTs(`[dismissSummaryAndReset] Called. internalWorkflowId: ${internalWorkflowId}, forceResetDueToError: ${forceResetDueToError}`);
    previousWorkflowIdOnDismissRef.current = internalWorkflowId; 
    justDismissedFlagRef.current = true; 
    
    if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
    }

    if (navigate) {
      navigate('/', { replace: true }); 
    }
    
    setInternalWorkflowId(null); 
    storeSetWorkflowId(null);   
    storeReset();
    setEmail('');
    setEmailError('');
    setScooterId(Math.floor(1000 + Math.random() * 9000).toString()); 
    setScooterIdError('');
    logTs(`[dismissSummaryAndReset] State reset. Setting dismiss timeout.`);

    dismissTimeoutRef.current = setTimeout(() => {
      logTs("[dismissSummaryAndReset] Dismiss timeout FIRED. Clearing flags.");
      justDismissedFlagRef.current = false;
      previousWorkflowIdOnDismissRef.current = null;
      dismissTimeoutRef.current = undefined;
    }, 200); 

  }, [navigate, storeReset, storeSetWorkflowId, internalWorkflowId, setInternalWorkflowId ]); 
  
  // Callback to handle starting a new ride
  const handleStartRide = useCallback(async () => {
    logTs(`[handleStartRide] Called. Email: ${email}, ScooterID: ${scooterId}`);
    const emailVal = validateEmailUtil(email);
    const scooterIdVal = validateScooterIdUtil(scooterId);

    setEmailError(emailVal.error || '');
    setScooterIdError(scooterIdVal.error || '');

    if (emailVal.isValid && scooterIdVal.isValid) {
      logTs(`[handleStartRide] Inputs valid. Calling startMutation.`);
      const pricePerThousand = 25; 
      const currency = "USD"; 
      setErrorMessage(null); 
      setIsRequestTimedOut(false); 
      await startMutation.mutateAsync({ emailAddress: email, scooterId, pricePerThousand, currency });
    }
  }, [email, scooterId, startMutation, validateEmailUtil, validateScooterIdUtil, setEmailError, setScooterIdError, setErrorMessage, setIsRequestTimedOut]);

  // Callback to handle ending the current ride
  const handleEndRide = useCallback(async () => {
    logTs(`[handleEndRide] Called. internalWorkflowId: ${internalWorkflowId}`);
    if (internalWorkflowId) {
      await endMutation.mutateAsync();
    } else {
      showTemporaryError('No active ride to end.');
    }
  }, [internalWorkflowId, endMutation, showTemporaryError]);

  // Deriving a user-friendly ride status message
  let rideStatusMessage = "Enter your email and unlock the scooter to start your ride.";
  if (errorMessage) {
    rideStatusMessage = ""; 
  } else if (startMutation.isPending) {
    rideStatusMessage = "Unlocking scooter...";
  } else if (endMutation.isPending) {
    rideStatusMessage = "Ending ride...";
  } else if (isLoadingRideState && !!internalWorkflowId && !isRideActiveState && !showSummary) {
    rideStatusMessage = `Loading ride state for ${internalWorkflowId}...`;
  } else if (isRideActiveState) {
    const currentPhase = rideStateData?.status?.phase;
    if (currentPhase === 'INITIALIZING') {
        rideStatusMessage = "Initializing ride...";
    } else if (currentPhase === 'BLOCKED') {
        rideStatusMessage = "Ride blocked. Check for messages.";
    } else { 
        rideStatusMessage = "Ride in progress. Use the right arrow key on your keyboard to move.";
    }
  } else if (showSummary) {
    if (rideStateData?.status?.phase === 'ENDED') {
      rideStatusMessage = "Ride ended.";
    } else if (internalWorkflowId) {
      rideStatusMessage = `Loading summary for ${internalWorkflowId}...`;
    } else {
      rideStatusMessage = "Summary displayed."; 
    }
  } else if (rideStateData?.status?.phase === 'FAILED') {
    if (!errorMessage) { 
      rideStatusMessage = "Ride attempt failed. Please check details below.";
    } else {
      rideStatusMessage = ""; 
    }
  } else if (internalWorkflowId && !isRideActiveState && !showSummary) {
    if (storeTokens > 0) { 
      rideStatusMessage = "Previous ride loaded. Unlock scooter to start a new ride.";
    }
  }

  // Effect for cleanup on component unmount
  useEffect(() => {
    logTs(`[useEffect Mount] Component/hook mounted.`);
    return () => {
      logTs(`[useEffect Unmount] Unmounting. Clearing timeouts.`);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []); 

  return {
    email, setEmail, emailError, setEmailError,
    scooterId, setScooterId, scooterIdError, setScooterIdError,
    isRideActive: isRideActiveState, 
    rideStateData, 
    isLoadingRideState: isLoadingRideState || (startMutation.isPending && !internalWorkflowId), 
    showSummary,
    errorMessage, 
    rideStatusMessage, 
    storeDistance,
    storeElapsed, 
    storeTokens,
    internalWorkflowId, 
    startMutation, 
    endMutation,   
    handleStartRide,
    handleEndRide,
    dismissSummaryAndReset,
    validateEmailUtil, 
    validateScooterIdUtil 
  };
};
