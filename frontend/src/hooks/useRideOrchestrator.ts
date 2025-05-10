// frontend/src/hooks/useRideOrchestrator.ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRideStore } from '../stores/rideStore';
import { useRideTimer } from './useRideTimer'; // Ensure this path is correct
import { useRideMutations } from './useRideMutations';
import { useRideStatePoller } from './useRideStatePoller';
import { fmtTime, calculateElapsedSeconds } from '../utils/timeUtils'; // Ensure calculateElapsedSeconds can handle null endedAt for active rides
import { validateEmail as validateEmailUtil, validateScooterId as validateScooterIdUtil } from '../utils/validationUtils';
import type { NavigateFunction } from 'react-router-dom';
// Ensure RideStateResponse is imported if calculateElapsedSeconds needs more from status
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
    elapsed: storeElapsed, // We will still use this from the store for the UI
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
  const [isRideActiveState, setIsRideActiveState] = useState(false); // Client's idea of whether the ride is active (for timer)
  const [rideStartTime, setRideStartTime] = useState<number | null>(null); // Epoch MS for the current/loaded ride

  const [showSummary, setShowSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false);

  const lastBucketRef = useRef(0);
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const requestTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const initializingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const endingRef = useRef(false);

  // localElapsedSeconds is now driven by rideStartTime
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
    // ... (mutations setup remains the same)
    workflowId: internalWorkflowId,
    validateEmailFn: validateEmailUtil,
    validateScooterIdFn: validateScooterIdUtil,
    onStartSuccess: (dataResponse) => {
      storeReset();
      lastBucketRef.current = 0;
      // Assuming dataResponse.status.startedAt exists and is the authoritative start time
      // If not, use Date.now() as a fallback, but server time is better.
      const startTimeFromServer = dataResponse.status?.startedAt ? new Date(dataResponse.status.startedAt).getTime() : Date.now();
      setRideStartTime(startTimeFromServer);
      setIsRideActiveState(true); // This will activate the useRideTimer with the new startTime
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
      setIsRideActiveState(false); // Stop the local timer
      storeSetIsAnimating(false);
      setShowSummary(true);
    },
    onEndSuccess: () => {
      endingRef.current = false;
      console.log('Ride end signal successful for workflow:', internalWorkflowId);
      // Poller will eventually update with ENDED state and final time
    },
    onEndError: (error: Error) => {
      endingRef.current = false;
      showTemporaryError(error.message || 'Failed to end ride');
      // If end failed, we might want to revert isRideActiveState if possible, based on actual state
    },
    onAddDistanceError: (error: Error) => {
      showTemporaryError(error.message || 'Failed to add distance');
    },
  });
  
  const pollerEnabled = useMemo(() => 
    internalWorkflowId !== null && (
      isRideActiveState || // Actively polling if client thinks ride is active
      // Or, if loading from URL or an existing ID, and not in other specific states
      (!startMutation.isPending && !endMutation.isPending && !showSummary)
    ),
    [internalWorkflowId, isRideActiveState, startMutation.isPending, endMutation.isPending, showSummary]
  );

  const { 
    data: rideStateData, 
    isLoading: isLoadingRideState, 
    // error: errorRideState, // ensure you're using errorRideState if that's your variable
    refetch: refetchRideState
  } = useRideStatePoller(internalWorkflowId, pollerEnabled);

  // Effect to update the Zustand store's elapsed time from our local authoritative timer
  useEffect(() => {
    storeSetElapsed(fmtTime(localElapsedSeconds));
  }, [localElapsedSeconds, storeSetElapsed]);


  // Effect to process data from the poller (rideStateData)
  useEffect(() => {
    if (rideStateData && rideStateData.status) {
      const serverPhase = rideStateData.status.phase;
      const isActiveFromServer = isActivePhase(serverPhase);
      const isInitializing = serverPhase === 'INITIALIZING';
      const isFailed = serverPhase === 'FAILED';
      const isEnded = serverPhase === 'ENDED';

      setIsRideActiveState(isActiveFromServer); // This controls the useRideTimer's "isActive" flag
      storeSetIsAnimating(isActiveFromServer && !isInitializing);

      if (isActiveFromServer && rideStateData.status.startedAt) {
        const serverStartTimeMs = new Date(rideStateData.status.startedAt).getTime();
        // Update our local rideStartTime only if it's different, to avoid unnecessary re-renders/recalculations
        if (rideStartTime !== serverStartTimeMs) {
          setRideStartTime(serverStartTimeMs);
        }
      } else if (!isActiveFromServer) {
        // If the ride is no longer active according to the server, clear local start time
        // This will cause useRideTimer to output 0.
        if (rideStartTime !== null) {
          setRideStartTime(null);
        }
      }

      if (isEnded || isFailed) {
        setShowSummary(true);
        // For ended or failed rides, explicitly set the elapsed time from server calculation
        // This overrides the local timer (which should be 0 anyway if !isActiveFromServer)
        const finalElapsedSeconds = calculateElapsedSeconds(
          rideStateData.status.startedAt,
          rideStateData.status.endedAt
        );
        storeSetElapsed(fmtTime(finalElapsedSeconds));
      } else {
        setShowSummary(false);
        // If it's active or initializing, the useEffect listening to localElapsedSeconds
        // will handle updating storeSetElapsed.
      }
      
      storeSetTokens(rideStateData.status.tokens?.total || 0);
      storeSetMovementDisabledMessage(rideStateData.status.lastError || null);
    }
  }, [rideStateData, storeSetTokens, storeSetElapsed, storeSetMovementDisabledMessage, storeSetIsAnimating, rideStartTime, setRideStartTime]);


  // Reset rideStartTime when the workflow ID changes (e.g. loading different ride or resetting)
  useEffect(() => {
    // This ensures that when a new workflow is loaded (either from URL or by clearing),
    // we don't carry over the old ride's start time.
    setRideStartTime(null);
  }, [internalWorkflowId]);


  // ---- Other useEffects for timeouts, addDistance, etc. remain largely the same ----
  useEffect(() => {
    // addDistance logic (this was correctly added by you in the latest version)
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
    // Handling workflowIdFromUrl changes
    if (workflowIdFromUrl && workflowIdFromUrl !== internalWorkflowId) {
      console.log(`URL has workflowId ${workflowIdFromUrl}, current is ${internalWorkflowId}. Resetting and loading.`);
      storeReset();
      setEmail(''); // Reset form fields
      // ... other resets as you have them ...
      setIsRideActiveState(false); // Important for timer reset
      setRideStartTime(null);      // Crucial: Reset start time
      setShowSummary(false);
      setInternalWorkflowId(workflowIdFromUrl);
      storeSetWorkflowId(workflowIdFromUrl);
      refetchRideState();
    } else if (!workflowIdFromUrl && internalWorkflowId && !isRideActiveState && !showSummary && !startMutation.isPending && !endMutation.isPending) {
      console.log('Clearing workflow ID as URL is empty and no active states');
      // dismissSummaryAndReset was here, ensure it also calls setRideStartTime(null) if not already covered by internalWorkflowId change
      setInternalWorkflowId(null); // This will trigger the useEffect that resets rideStartTime
      storeSetWorkflowId(null);
      storeReset(); // Full reset
      setIsRideActiveState(false);
      setShowSummary(false);
    }
  }, [
    workflowIdFromUrl, internalWorkflowId, storeReset, storeSetWorkflowId, refetchRideState, 
    isRideActiveState, showSummary, startMutation.isPending, endMutation.isPending
    // Removed dismissSummaryAndReset to avoid circular dependencies if it calls setInternalWorkflowId
  ]);
  
  // Effect for storeWorkflowId changes (ensure it also resets rideStartTime)
  useEffect(() => {
    if (storeWorkflowId && storeWorkflowId !== internalWorkflowId) {
      setInternalWorkflowId(storeWorkflowId); // This will trigger the reset of rideStartTime via the other effect
    } else if (!storeWorkflowId && internalWorkflowId) {
      setInternalWorkflowId(null); // This also triggers rideStartTime reset
      storeReset();
      setIsRideActiveState(false);
      setShowSummary(false);
    }
  }, [storeWorkflowId, internalWorkflowId, storeReset]);


  // ... (handleStartRide, handleEndRide, dismissSummaryAndReset, rideStatusMessage, return object remain similar)
  // Ensure dismissSummaryAndReset also sets rideStartTime to null.
  const dismissSummaryAndReset = useCallback((forceResetDueToError = false) => {
    setShowSummary(false);
    setInternalWorkflowId(null); // This will trigger the effect to nullify rideStartTime
    storeSetWorkflowId(null);
    storeReset();
    setIsRideActiveState(false);
    // setRideStartTime(null); // Explicitly here or rely on internalWorkflowId effect
    if (navigate) { // Removed forceResetDueToError logic for simplicity, re-add if needed
      navigate('/', { replace: true });
    }
  }, [navigate, storeReset, storeSetWorkflowId]);
  
  const handleStartRide = useCallback(async () => {
    const emailVal = validateEmailUtil(email);
    const scooterIdVal = validateScooterIdUtil(scooterId);

    setEmailError(emailVal.error || '');
    setScooterIdError(scooterIdVal.error || '');

    if (emailVal.isValid && scooterIdVal.isValid) {
      const pricePerThousand = 25; // Example
      const currency = "USD"; // Example
      // setRideStartTime(null); // Ensure old start time is cleared before attempting to start
      await startMutation.mutateAsync({ emailAddress: email, scooterId, pricePerThousand, currency });
      // onStartSuccess will set the new rideStartTime
    }
  }, [email, scooterId, startMutation]);

  const handleEndRide = useCallback(async () => {
    if (internalWorkflowId) {
      await endMutation.mutateAsync();
      // isRideActiveState will be set to false in onEndMutate, stopping the timer.
      // The poller will then fetch the final state including endedAt.
    } else {
      showTemporaryError('No active ride to end.');
    }
  }, [internalWorkflowId, endMutation, showTemporaryError]);

  // ... (rideStatusMessage and return object)

  let rideStatusMessage = "Enter your email and unlock the scooter to start your ride.";
  // (Status message logic remains the same)
  if (startMutation.isPending) {
    rideStatusMessage = "Unlocking scooter...";
  } else if (endMutation.isPending) {
    rideStatusMessage = "Ending ride...";
  } else if (isLoadingRideState && !!internalWorkflowId && !isRideActiveState && !showSummary) {
    rideStatusMessage = `Loading ride state for ${internalWorkflowId}...`;
  } else if (isRideActiveState) {
    rideStatusMessage = "Ride in progress. Use the right arrow key on your keyboard to move.";
  } else if (showSummary) {
    rideStatusMessage = "Ride ended.";
  } else if (internalWorkflowId && storeTokens > 0 && !isRideActiveState) {
    rideStatusMessage = "Previous ride ended. Unlock scooter to start a new ride.";
  } else if (errorMessage) {
    rideStatusMessage = "";
  }

  return {
    email, setEmail, emailError, setEmailError,
    scooterId, setScooterId, scooterIdError, setScooterIdError,
    isRideActive: isRideActiveState,
    rideStateData,
    isLoadingRideState: isLoadingRideState || isRequestTimedOut,
    showSummary,
    errorMessage,
    rideStatusMessage,
    // localElapsedSeconds, // Not directly exposed if storeElapsed is the primary display value
    storeDistance,
    storeElapsed, // This is what HUD will consume, updated smoothly
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