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
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false); 

  const lastBucketRef = useRef(0);
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const endingRef = useRef(false);

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
      setShowSummary(false); // Ensure summary is not shown on new ride start
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
      setShowSummary(false); // Explicitly hide summary on start error
    },
    onEndMutate: () => {
      endingRef.current = true;
      setIsRideActiveState(false); 
      storeSetIsAnimating(false);
      // setShowSummary(true); // Summary visibility will be determined by poller based on final state (ENDED or FAILED)
    },
    onEndSuccess: () => {
      endingRef.current = false;
      console.log('Ride end signal successful for workflow:', internalWorkflowId);
      // Poller will update with ENDED state.
    },
    onEndError: (error: Error) => {
      endingRef.current = false;
      showTemporaryError(error.message || 'Failed to end ride');
      setShowSummary(false); // If ending fails, don't show summary, rely on error messages/polled FAILED state
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

  // Effect to process data from the poller (rideStateData)
  useEffect(() => {
    if (!internalWorkflowId) {
      setShowSummary(false);
      setIsRideActiveState(false); 
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
      
      // Updated logic for showing summary:
      if (isEnded) {
        // Only show summary if the ride successfully ended.
        if (internalWorkflowId) { // Ensure we have a workflow context for the summary
            setShowSummary(true);
        }
        // Calculate final elapsed time for ended rides.
        const finalElapsedSeconds = calculateElapsedSeconds(
          rideStateData.status.startedAt,
          rideStateData.status.endedAt
        );
        storeSetElapsed(fmtTime(finalElapsedSeconds));
      } else if (isFailed) {
        // If the ride failed, do NOT show the summary.
        setShowSummary(false);
        // The WorkflowFailureDisplay or ErrorMessageDisplay should handle the UI.
        // Reset or set elapsed time appropriately for a failed ride.
        // For a start failure, startedAt might be null or same as endedAt.
        if (rideStateData.status.startedAt && rideStateData.status.endedAt) {
             const finalElapsedSeconds = calculateElapsedSeconds(
                rideStateData.status.startedAt,
                rideStateData.status.endedAt
            );
            storeSetElapsed(fmtTime(finalElapsedSeconds));
        } else if (rideStateData.status.startedAt) {
            // Failed, but startedAt exists, endedAt might be null if it crashed
            const finalElapsedSeconds = calculateElapsedSeconds(
                rideStateData.status.startedAt,
                undefined // Or Date.now() if we want to show time until failure detection
            );
            storeSetElapsed(fmtTime(finalElapsedSeconds));
        }
        else {
            storeSetElapsed(fmtTime(0)); // Default to 0 if critical times are missing (e.g. pre-start failure)
        }
      } else {
        // For any other active/initializing phases, summary should not be shown.
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
    rideStartTime, 
    setRideStartTime,
    setIsRideActiveState, 
    setShowSummary 
  ]);

  useEffect(() => {
    setRideStartTime(null);
  }, [internalWorkflowId]);

  useEffect(() => {
    if (workflowIdFromUrl) {
      if (justDismissedFlagRef.current && workflowIdFromUrl === previousWorkflowIdOnDismissRef.current) {
        console.log(`Ignoring stale workflowIdFromUrl (${workflowIdFromUrl}) immediately after dismissal.`);
        return; 
      }
      if (workflowIdFromUrl !== internalWorkflowId) {
        console.log(`URL has workflowId ${workflowIdFromUrl}, current internal is ${internalWorkflowId}. Resetting and loading from URL.`);
        storeReset();
        setEmail('');
        setShowSummary(false); 
        setInternalWorkflowId(workflowIdFromUrl); 
        storeSetWorkflowId(workflowIdFromUrl); 
        refetchRideState(); 
        if (justDismissedFlagRef.current) {
            justDismissedFlagRef.current = false;
            previousWorkflowIdOnDismissRef.current = null;
            if(dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        }
      }
    } else {
      if (internalWorkflowId && !justDismissedFlagRef.current) {
        console.log(`URL cleared (now ${workflowIdFromUrl}), and internalWorkflowId (${internalWorkflowId}) was set. Resetting internal state.`);
        storeReset(); 
        setShowSummary(false);
        setIsRideActiveState(false);
        setInternalWorkflowId(null); 
        storeSetWorkflowId(null); 
      }
    }
  }, [
      workflowIdFromUrl, 
      internalWorkflowId, 
      storeReset, 
      storeSetWorkflowId, 
      refetchRideState,
      // No direct need for setEmail, setIsRideActiveState, setShowSummary, setInternalWorkflowId as deps
      // because they are either setters from this hook or their changes are driven by other state here.
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
    if (storeWorkflowId && storeWorkflowId !== internalWorkflowId) {
      console.log(`storeWorkflowId (${storeWorkflowId}) changed and differs from internal (${internalWorkflowId}). Syncing internal.`);
      setInternalWorkflowId(storeWorkflowId);
      setShowSummary(false); 
    } else if (!storeWorkflowId && internalWorkflowId) {
      console.log(`storeWorkflowId cleared, but internalWorkflowId (${internalWorkflowId}) was set. Resetting.`);
      storeReset();
      setIsRideActiveState(false);
      setShowSummary(false);
      setInternalWorkflowId(null); 
    }
  }, [storeWorkflowId, internalWorkflowId, storeReset]);

  const dismissSummaryAndReset = useCallback((forceResetDueToError = false) => {
    console.log(`Dismissing summary for workflow: ${internalWorkflowId}`);
    previousWorkflowIdOnDismissRef.current = internalWorkflowId; 
    justDismissedFlagRef.current = true; 
    
    if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
    }

    if (navigate) {
      navigate('/', { replace: true }); 
    }
    
    setShowSummary(false);
    setInternalWorkflowId(null); 
    storeSetWorkflowId(null);   
    storeReset();
    setIsRideActiveState(false);
    setEmail('');
    setEmailError('');
    setScooterId(Math.floor(1000 + Math.random() * 9000).toString());
    setScooterIdError('');
    setErrorMessage(null); 

    dismissTimeoutRef.current = setTimeout(() => {
      console.log("Clearing justDismissedFlagRef and previousWorkflowIdOnDismissRef via timeout.");
      justDismissedFlagRef.current = false;
      previousWorkflowIdOnDismissRef.current = null;
      dismissTimeoutRef.current = undefined;
    }, 200); 

  }, [navigate, storeReset, storeSetWorkflowId, internalWorkflowId]); 
  
  const handleStartRide = useCallback(async () => {
    const emailVal = validateEmailUtil(email);
    const scooterIdVal = validateScooterIdUtil(scooterId);

    setEmailError(emailVal.error || '');
    setScooterIdError(scooterIdVal.error || '');

    if (emailVal.isValid && scooterIdVal.isValid) {
      const pricePerThousand = 25; 
      const currency = "USD"; 
      setShowSummary(false); // Ensure summary is hidden before attempting a new start
      await startMutation.mutateAsync({ emailAddress: email, scooterId, pricePerThousand, currency });
    }
  }, [email, scooterId, startMutation, validateEmailUtil, validateScooterIdUtil, setShowSummary]); // Added setShowSummary

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
    // If loading state for an existing ID, and not showing summary (e.g. not ENDED)
    rideStatusMessage = `Loading ride state for ${internalWorkflowId}...`;
  } else if (isRideActiveState) {
    rideStatusMessage = "Ride in progress. Use the right arrow key on your keyboard to move.";
  } else if (showSummary) { // This will now only be true for successfully ENDED rides
    if (rideStateData?.status?.phase === 'ENDED') {
        rideStatusMessage = "Ride ended.";
    } else if (internalWorkflowId) { 
        // This case should be less common if showSummary is true only for ENDED.
        // Could be a brief moment if summary is true but rideStateData is slightly delayed.
        rideStatusMessage = `Loading summary for ${internalWorkflowId}...`;
    } else {
        rideStatusMessage = "Summary displayed."; // Fallback
    }
  } else if (rideStateData?.status?.phase === 'FAILED') {
    // If not showing summary, but the phase is FAILED, let other components (WorkflowFailureDisplay) show details.
    // The rideStatusMessage can be more generic or reflect the failure if not handled by errorMessage.
    if (!errorMessage) { // Avoid overriding a more specific error message
        rideStatusMessage = "Ride attempt failed. Please check details below.";
    } else {
        rideStatusMessage = ""; // Let ErrorMessageDisplay handle it
    }
  } else if (internalWorkflowId && !isRideActiveState && !showSummary) {
    // Covers states like INITIALIZING, BLOCKED, or a loaded non-active, non-ended, non-failed ride
     if (rideStateData?.status?.phase === 'INITIALIZING') {
        rideStatusMessage = "Initializing ride...";
    } else if (rideStateData?.status?.phase === 'BLOCKED') {
        rideStatusMessage = "Ride blocked. Check for messages.";
    } else if (storeTokens > 0) { // Previously loaded ride that was ended (and summary dismissed)
        rideStatusMessage = "Previous ride loaded. Unlock scooter to start a new ride.";
    }
    // If no specific message, the default "Enter email..." will show if no internalWorkflowId
  }
  
  if (errorMessage) { // errorMessage takes precedence for the status message area if set
    rideStatusMessage = ""; 
  }


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
