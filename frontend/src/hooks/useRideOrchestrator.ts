// frontend/src/hooks/useRideOrchestrator.ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRideStore } from '../stores/rideStore';
import { useRideTimer } from './useRideTimer';
import { useRideMutations } from './useRideMutations';
import { useRideStatePoller } from './useRideStatePoller';
import { fmtTime, calculateElapsedSeconds } from '../utils/timeUtils';
import { validateEmail as validateEmailUtil, validateScooterId as validateScooterIdUtil } from '../utils/validationUtils';
import type { NavigateFunction } from 'react-router-dom';
// import type { RideStateResponse } from '../api/rideApi'; 


const ACTIVE_PHASES = ['INITIALIZING', 'ACTIVE', 'BLOCKED'] as const;
type ActivePhase = typeof ACTIVE_PHASES[number];

const isActivePhase = (phase: string): phase is ActivePhase => {
  return ACTIVE_PHASES.includes(phase as ActivePhase);
};

export const useRideOrchestrator = (
  workflowIdFromUrl?: string | null,
  navigate?: NavigateFunction
) => {
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

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [scooterId, setScooterId] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [scooterIdError, setScooterIdError] = useState('');
  
  const [internalWorkflowId, setInternalWorkflowId] = useState<string | null>(
    workflowIdFromUrl || storeWorkflowId
  );
  const [isRideActiveState, setIsRideActiveState] = useState(false);
  const [rideStartTime, setRideStartTime] = useState<number | null>(null);

  const [showSummary, setShowSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false); // Not used in provided snippet, but kept

  const lastBucketRef = useRef(0);
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  // const requestTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined); // Not used
  // const initializingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined); // Not used
  const endingRef = useRef(false);

  // Refs to manage state during dismissal to prevent race conditions with URL updates
  const previousWorkflowIdOnDismissRef = useRef<string | null | undefined>(null);
  const justDismissedFlagRef = useRef(false);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);


  const localElapsedSeconds = useRideTimer(isRideActiveState, rideStartTime);

  const showTemporaryError = useCallback((message: string) => {
    setErrorMessage(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setErrorMessage(null), 5000);
  }, []);

  const { 
    startMutation, 
    endMutation, 
    addDistanceMutation 
  } = useRideMutations({
    workflowId: internalWorkflowId,
    validateEmailFn: validateEmailUtil,
    validateScooterIdFn: validateScooterIdUtil,
    onStartSuccess: (dataResponse) => {
      storeReset();
      lastBucketRef.current = 0;
      const startTimeFromServer = dataResponse.status?.startedAt ? new Date(dataResponse.status.startedAt).getTime() : Date.now();
      setRideStartTime(startTimeFromServer);
      setIsRideActiveState(true);
      storeSetIsAnimating(true);
      storeSetMovementDisabledMessage(null);
      setShowSummary(false);
      setInternalWorkflowId(dataResponse.workflowId);
      storeSetWorkflowId(dataResponse.workflowId);
      if (navigate) {
        navigate(`/ride/${dataResponse.workflowId}`, { replace: true });
      }
      console.log('Ride started, workflowId:', dataResponse.workflowId);
    },
    onStartError: (error: Error) => {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showTemporaryError('Unable to connect to the server. Please check if the API is running.');
      } else {
        showTemporaryError(error.message || 'Failed to start ride');
      }
      storeSetIsAnimating(false);
      storeSetMovementDisabledMessage('Unable to start ride. Please try again.');
    },
    onEndMutate: () => {
      endingRef.current = true;
      setIsRideActiveState(false);
      storeSetIsAnimating(false);
      setShowSummary(true);
    },
    onEndSuccess: () => {
      endingRef.current = false;
      console.log('Ride end signal successful for workflow:', internalWorkflowId);
    },
    onEndError: (error: Error) => {
      endingRef.current = false;
      showTemporaryError(error.message || 'Failed to end ride');
    },
    onAddDistanceError: (error: Error) => {
      showTemporaryError(error.message || 'Failed to add distance');
    },
  });
  
  const pollerEnabled = useMemo(() => 
    internalWorkflowId !== null && (
      isRideActiveState || 
      (!startMutation.isPending && !endMutation.isPending && !showSummary)
    ),
    [internalWorkflowId, isRideActiveState, startMutation.isPending, endMutation.isPending, showSummary]
  );

  const { 
    data: rideStateData, 
    isLoading: isLoadingRideState, 
    refetch: refetchRideState
  } = useRideStatePoller(internalWorkflowId, pollerEnabled);

  useEffect(() => {
    storeSetElapsed(fmtTime(localElapsedSeconds));
  }, [localElapsedSeconds, storeSetElapsed]);

  useEffect(() => {
    if (!internalWorkflowId) {
      setShowSummary(false);
      setIsRideActiveState(false); 
      // setRideStartTime(null); // Handled by its own effect watching internalWorkflowId
      return; 
    }

    if (rideStateData && rideStateData.status) {
      const serverPhase = rideStateData.status.phase;
      const isActiveFromServer = isActivePhase(serverPhase);
      const isInitializing = serverPhase === 'INITIALIZING';
      const isFailed = serverPhase === 'FAILED';
      const isEnded = serverPhase === 'ENDED';

      setIsRideActiveState(isActiveFromServer);
      storeSetIsAnimating(isActiveFromServer && !isInitializing);

      if (isActiveFromServer && rideStateData.status.startedAt) {
        const serverStartTimeMs = new Date(rideStateData.status.startedAt).getTime();
        if (rideStartTime !== serverStartTimeMs) {
          setRideStartTime(serverStartTimeMs);
        }
      } else if (!isActiveFromServer) {
        if (rideStartTime !== null) {
          setRideStartTime(null);
        }
      }
      
      if (isEnded || isFailed) {
        // Only show summary if not in the process of an immediate dismissal that cleared internalWorkflowId
        // This check is mostly defensive; the primary guard is `if (!internalWorkflowId)` above.
        if (internalWorkflowId) { 
            setShowSummary(true);
        }
        const finalElapsedSeconds = calculateElapsedSeconds(
          rideStateData.status.startedAt,
          rideStateData.status.endedAt
        );
        storeSetElapsed(fmtTime(finalElapsedSeconds));
      } else {
        setShowSummary(false);
      }
      
      storeSetTokens(rideStateData.status.tokens?.total || 0);
      storeSetMovementDisabledMessage(rideStateData.status.lastError || null);
    }
  }, [
    internalWorkflowId, 
    rideStateData, 
    storeSetTokens, 
    storeSetElapsed, 
    storeSetMovementDisabledMessage, 
    storeSetIsAnimating, 
    rideStartTime, // rideStartTime is read, so it's a dependency
    setRideStartTime, // setRideStartTime is called
    setIsRideActiveState, // setIsRideActiveState is called
    setShowSummary // setShowSummary is called
  ]);

  useEffect(() => {
    // If internalWorkflowId changes (e.g., new ride loaded, or cleared by dismiss/URL change),
    // reset rideStartTime. The poller effect will set the correct start time if a ride is active.
    setRideStartTime(null);
  }, [internalWorkflowId]);

  // Effect to handle workflowIdFromUrl changes (e.g. direct navigation, page load with ID)
  useEffect(() => {
    if (workflowIdFromUrl) {
      // There is a workflow ID in the URL.

      // Check if we are in the brief period after dismissing this *specific* workflow ID,
      // and the navigate('/') call hasn't yet updated the workflowIdFromUrl prop to null/undefined.
      if (justDismissedFlagRef.current && workflowIdFromUrl === previousWorkflowIdOnDismissRef.current) {
        console.log(`Ignoring stale workflowIdFromUrl (${workflowIdFromUrl}) immediately after dismissal.`);
        return; // Prevent reloading the summary of the just-dismissed ride
      }

      // If the URL's workflow ID is different from the one currently active internally,
      // or if no workflow is active internally (internalWorkflowId is null), then load it.
      if (workflowIdFromUrl !== internalWorkflowId) {
        console.log(`URL has workflowId ${workflowIdFromUrl}, current internal is ${internalWorkflowId}. Resetting and loading from URL.`);
        storeReset();
        setEmail('');
        // setIsRideActiveState(false); // Let poller/start logic handle this based on fetched state
        // setRideStartTime(null); // Effect on internalWorkflowId will handle this
        setShowSummary(false); // Start with summary hidden; poller will show if necessary
        
        setInternalWorkflowId(workflowIdFromUrl); // Load the new workflow
        storeSetWorkflowId(workflowIdFromUrl); // Keep store in sync
        refetchRideState(); // Explicitly refetch for the new ID
        
        // If we proceed to load, ensure any lingering "dismiss" context is cleared.
        if (justDismissedFlagRef.current) {
            justDismissedFlagRef.current = false;
            previousWorkflowIdOnDismissRef.current = null;
            if(dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        }
      }
      // If workflowIdFromUrl === internalWorkflowId, do nothing, it's already the current context.
    } else {
      // workflowIdFromUrl is null or undefined (e.g., user navigated to '/' or base path).
      // If an internalWorkflowId is still set, and we weren't just in the process of dismissing,
      // it means we've navigated away from a specific ride page (e.g., browser back button).
      // In this case, we should clear the internal ride state.
      if (internalWorkflowId && !justDismissedFlagRef.current) {
        console.log(`URL cleared (now ${workflowIdFromUrl}), and internalWorkflowId (${internalWorkflowId}) was set. Resetting internal state.`);
        storeReset(); // Reset general store state
        setShowSummary(false);
        setIsRideActiveState(false);
        // setRideStartTime(null); // Handled by internalWorkflowId effect
        setInternalWorkflowId(null); // This is the primary trigger for resetting ride-specific state
        storeSetWorkflowId(null); // Keep store in sync
      }
      // If justDismissedFlagRef.current is true, it means navigate('/') from dismiss just completed.
      // workflowIdFromUrl is now correctly null/undefined. The flag will clear via its timeout.
    }
  }, [
      workflowIdFromUrl, 
      internalWorkflowId, 
      storeReset, 
      storeSetWorkflowId, 
      refetchRideState, 
      // setEmail is not directly used for reset logic here, but for form state
      // setIsRideActiveState, setShowSummary, setInternalWorkflowId are setters from this hook
  ]);

  useEffect(() => {
    if (!isRideActiveState || storeDistance <= 0 || !internalWorkflowId) {
      if (storeDistance === 0) lastBucketRef.current = 0;
      return;
    }
    const currentBucket = Math.floor(storeDistance / 100);
    const previousBucket = lastBucketRef.current;
    if (currentBucket > previousBucket) {
      for (let i = previousBucket + 1; i <= currentBucket; i++) {
        addDistanceMutation.mutate();
      }
      lastBucketRef.current = currentBucket;
    }
  }, [storeDistance, isRideActiveState, addDistanceMutation, internalWorkflowId]);
  
  useEffect(() => {
    // Effect for storeWorkflowId changes (e.g. from dev tools or other parts of app)
    if (storeWorkflowId && storeWorkflowId !== internalWorkflowId) {
      // If store ID changes and differs, update internal to match, triggering load/reset logic
      // This will also trigger the rideStartTime reset via its dedicated effect.
      console.log(`storeWorkflowId (${storeWorkflowId}) changed and differs from internal (${internalWorkflowId}). Syncing internal.`);
      setInternalWorkflowId(storeWorkflowId);
      // The workflowIdFromUrl effect might also run if workflowIdFromUrl is also different.
      // Ensure showSummary is reset if we are loading a new ID from store.
      setShowSummary(false); 
    } else if (!storeWorkflowId && internalWorkflowId) {
      // If store ID is cleared and we have an internal one, clear internal state.
      console.log(`storeWorkflowId cleared, but internalWorkflowId (${internalWorkflowId}) was set. Resetting.`);
      storeReset();
      setIsRideActiveState(false);
      setShowSummary(false);
      setInternalWorkflowId(null); // This triggers rideStartTime reset
    }
  }, [storeWorkflowId, internalWorkflowId, storeReset]); // Removed setIsRideActiveState, setShowSummary from deps as they are part of this hook's state

  const dismissSummaryAndReset = useCallback((forceResetDueToError = false) => {
    console.log(`Dismissing summary for workflow: ${internalWorkflowId}`);
    // Store the ID we are dismissing to help the URL effect ignore stale prop
    previousWorkflowIdOnDismissRef.current = internalWorkflowId; 
    justDismissedFlagRef.current = true; 
    
    // Clear any existing timeout to avoid premature reset of the flag
    if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
    }

    if (navigate) {
      navigate('/', { replace: true }); // This will eventually set workflowIdFromUrl to null/undefined
    }
    
    // Reset all relevant state immediately
    setShowSummary(false);
    setInternalWorkflowId(null); // This should trigger the effect that nulls rideStartTime
    storeSetWorkflowId(null);   // This might trigger its own effect if not already null
    storeReset();
    setIsRideActiveState(false);
    // setRideStartTime(null); // Effect for internalWorkflowId handles this due to setInternalWorkflowId(null)
    setEmail('');
    setEmailError('');
    // Keep current scooterId or generate new one? Original code generates new.
    setScooterId(Math.floor(1000 + Math.random() * 9000).toString());
    setScooterIdError('');
    setErrorMessage(null); // Clear any persistent error messages

    // Set a timeout to clear the dismiss flag.
    // This duration should be long enough for navigate('/') to propagate its change to workflowIdFromUrl.
    dismissTimeoutRef.current = setTimeout(() => {
      console.log("Clearing justDismissedFlagRef and previousWorkflowIdOnDismissRef via timeout.");
      justDismissedFlagRef.current = false;
      previousWorkflowIdOnDismissRef.current = null;
      dismissTimeoutRef.current = undefined;
    }, 200); // milliseconds (Increased slightly from 150 to 200 for a bit more buffer)

  }, [navigate, storeReset, storeSetWorkflowId, internalWorkflowId]); // internalWorkflowId is a dep because it's read for previousWorkflowIdOnDismissRef
  
  const handleStartRide = useCallback(async () => {
    const emailVal = validateEmailUtil(email);
    const scooterIdVal = validateScooterIdUtil(scooterId);

    setEmailError(emailVal.error || '');
    setScooterIdError(scooterIdVal.error || '');

    if (emailVal.isValid && scooterIdVal.isValid) {
      const pricePerThousand = 25; 
      const currency = "USD"; 
      // setRideStartTime(null); // Cleared by onStartSuccess or by internalWorkflowId change if applicable
      await startMutation.mutateAsync({ emailAddress: email, scooterId, pricePerThousand, currency });
    }
  }, [email, scooterId, startMutation, validateEmailUtil, validateScooterIdUtil]); // Added missing validation util deps

  const handleEndRide = useCallback(async () => {
    if (internalWorkflowId) {
      await endMutation.mutateAsync();
    } else {
      showTemporaryError('No active ride to end.');
    }
  }, [internalWorkflowId, endMutation, showTemporaryError]);

  let rideStatusMessage = "Enter your email and unlock the scooter to start your ride.";
  if (startMutation.isPending) {
    rideStatusMessage = "Unlocking scooter...";
  } else if (endMutation.isPending) {
    rideStatusMessage = "Ending ride...";
  } else if (isLoadingRideState && !!internalWorkflowId && !isRideActiveState && !showSummary) {
    rideStatusMessage = `Loading ride state for ${internalWorkflowId}...`;
  } else if (isRideActiveState) {
    rideStatusMessage = "Ride in progress. Use the right arrow key on your keyboard to move.";
  } else if (showSummary) {
    // Check if rideStateData exists and phase is ENDED/FAILED before declaring "Ride ended."
    // This prevents "Ride ended." from showing if summary is true but data is not yet loaded for it.
    if (rideStateData?.status?.phase === 'ENDED' || rideStateData?.status?.phase === 'FAILED') {
        rideStatusMessage = "Ride ended.";
    } else if (internalWorkflowId) {
        // If summary is shown but state isn't ENDED/FAILED (e.g. loading summary)
        rideStatusMessage = `Loading summary for ${internalWorkflowId}...`;
    } else {
        // Fallback if showSummary is true but no ID (shouldn't happen with current logic)
        rideStatusMessage = "Summary displayed.";
    }
  } else if (internalWorkflowId && storeTokens > 0 && !isRideActiveState) {
    // This case might be covered by showSummary if the ride just ended.
    // If it's a previously loaded ride that was already ended.
    rideStatusMessage = "Previous ride loaded. Unlock scooter to start a new ride.";
  } else if (errorMessage) {
    rideStatusMessage = ""; // Error message will be displayed by ErrorMessageDisplay
  }


  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
    };
  }, []);

  return {
    email, setEmail, emailError, setEmailError,
    scooterId, setScooterId, scooterIdError, setScooterIdError,
    isRideActive: isRideActiveState,
    rideStateData,
    isLoadingRideState: isLoadingRideState || (startMutation.isPending && !internalWorkflowId), // Adjusted loading state
    showSummary,
    errorMessage,
    rideStatusMessage,
    storeDistance,
    storeElapsed, 
    storeTokens,
    internalWorkflowId,
    startMutation, // Expose for pending states
    endMutation,   // Expose for pending states
    handleStartRide,
    handleEndRide,
    dismissSummaryAndReset,
    validateEmailUtil,
    validateScooterIdUtil
  };
};
