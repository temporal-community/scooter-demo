import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useRideStore } from '../stores/rideStore';
import { useRideTimer } from './useRideTimer';
import { useRideMutations } from './useRideMutations';
import { useRideStatePoller } from './useRideStatePoller';
import { fmtTime } from '../utils/timeUtils';
import type { NavigateFunction } from 'react-router-dom';
import { logTs } from './rideOrchestrator.utils';
import { useRideInputs } from './useRideInputs';
import { useRideWorkflowAndLifecycle } from './useRideWorkflowAndLifecycle';
import type { RideStateResponse } from '../api/rideApi'; // Changed to use the API type

export const useRideOrchestrator = (
  workflowIdFromUrl?: string | null,
  navigate?: NavigateFunction
) => {
  // 1. Zustand Store
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

  // 2. Inputs Hook
  const {
    email, setEmail, emailError, setEmailError,
    scooterId, setScooterId, scooterIdError, setScooterIdError,
    validateEmailUtil, validateScooterIdUtil,
    resetInputs: resetInputFields,
  } = useRideInputs();

  // 3. Refs
  const lastBucketRef = useRef(0);
  const endingRef = useRef(false);
  const unlockMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for the unlock success message timeout

  // 4. Local State for Orchestrator
  const [mutationWorkflowId, setMutationWorkflowId] = useState<string | null>(workflowIdFromUrl || storeWorkflowId);
  const [pollerWorkflowId, setPollerWorkflowId] = useState<string | null>(workflowIdFromUrl || storeWorkflowId);
  const [pollerEnabledState, setPollerEnabledState] = useState(false);
  const [unlockSuccessMessageActive, setUnlockSuccessMessageActive] = useState(false); // State for the unlock success message
  const [isInitializing, setIsInitializing] = useState(false); // New state to track initialization phase

  // 5. Mutations Hook
  const {
    startMutation,
    endMutation,
    addDistanceMutation
  } = useRideMutations({
    workflowId: mutationWorkflowId,
    validateEmailFn: validateEmailUtil,
    validateScooterIdFn: validateScooterIdUtil,
    onStartSuccess: (dataResponse) => {
        logTs('[Orchestrator onStartSuccess] Placeholder. Actual logic handled in handleStartRide.', dataResponse);
    },
    onStartError: (error: Error) => {
        logTs('[Orchestrator onStartError] Placeholder. Actual logic handled in handleStartRide.', error);
    },
    onEndMutate: () => {
        logTs('[Orchestrator onEndMutate] Placeholder. Actual logic handled in handleEndRide.');
        endingRef.current = true;
    },
    onEndSuccess: () => {
        logTs('[Orchestrator onEndSuccess] Placeholder. Actual logic handled in handleEndRide.');
        endingRef.current = false;
    },
    onEndError: (error: Error) => {
        logTs('[Orchestrator onEndError] Placeholder. Actual logic handled in handleEndRide.', error);
        endingRef.current = false;
    },
    onAddDistanceError: (error: Error) => {
        logTs('[Orchestrator onAddDistanceError] Placeholder. Actual logic handled in distance effect.', error);
    },
  });

  // 6. Poller Hook
  const {
    data: rideStateData, // This is RideStateResponse from api/rideApi (or similar)
    isLoading: isLoadingRideState,
    refetch: refetchRideState
  } = useRideStatePoller(pollerWorkflowId, pollerEnabledState);

  // Prepare rideStateData for useRideWorkflowAndLifecycle
  const rideStateDataForWorkflow: RideStateResponse | null | undefined = useMemo(() => {
    if (rideStateData && pollerWorkflowId) {
      return {
        ...(rideStateData as any), 
        workflowId: pollerWorkflowId,
      };
    }
    return undefined;
  }, [rideStateData, pollerWorkflowId]);


  // 7. Workflow and Lifecycle Hook
  const workflowApi = useRideWorkflowAndLifecycle({
    workflowIdFromUrl,
    navigate,
    storeWorkflowId, storeSetWorkflowId, storeReset,
    storeSetTokens, storeSetElapsed, storeSetMovementDisabledMessage, storeSetIsAnimating,
    rideStateData: rideStateDataForWorkflow,
    refetchRideState,
    isStartMutationPending: startMutation.isPending,
    resetInputFields,
  });

  // Sync workflowId for mutations and poller from workflowApi
  useEffect(() => {
    setMutationWorkflowId(workflowApi.internalWorkflowId);
    setPollerWorkflowId(workflowApi.internalWorkflowId);
  }, [workflowApi.internalWorkflowId]);

  // Sync pollerEnabledState from workflowApi and mutation states
  useEffect(() => {
    const enabled = workflowApi.internalWorkflowId !== null && (
      workflowApi.isRideActiveState ||
      (!startMutation.isPending && !endMutation.isPending && !workflowApi.showSummary)
    );
    setPollerEnabledState(enabled);
    logTs(`[Orchestrator pollerEnabled effect] Poller enabled: ${enabled}, internalWorkflowId: ${workflowApi.internalWorkflowId}, isRideActiveState: ${workflowApi.isRideActiveState}, startPending: ${startMutation.isPending}, endPending: ${endMutation.isPending}, showSummary: ${workflowApi.showSummary}`);
  }, [workflowApi.internalWorkflowId, workflowApi.isRideActiveState, startMutation.isPending, endMutation.isPending, workflowApi.showSummary]);

  // 8. Ride Timer
  const localElapsedSeconds = useRideTimer(workflowApi.isRideActiveState, workflowApi.rideStartTime);

  // Effect to update the elapsed time in the Zustand store
  useEffect(() => {
    storeSetElapsed(fmtTime(localElapsedSeconds));
  }, [localElapsedSeconds, storeSetElapsed]);

  // 9. Action Handlers
  const handleStartRide = useCallback(async () => {
    logTs(`[Orchestrator handleStartRide] Called. Email: ${email}, ScooterID: ${scooterId}`);
    const emailVal = validateEmailUtil(email); // Client-side validation
    const scooterIdVal = validateScooterIdUtil(scooterId); // Client-side validation

    setEmailError(emailVal.error || '');
    setScooterIdError(scooterIdVal.error || '');

    if (emailVal.isValid && scooterIdVal.isValid) {
      logTs(`[Orchestrator handleStartRide] Inputs valid. Calling startMutation.`);
      const pricePerThousand = 25;
      const currency = "USD";
      workflowApi.setErrorMessage(null);
      workflowApi.setIsRequestTimedOut(false);

      if (unlockMessageTimeoutRef.current) {
        clearTimeout(unlockMessageTimeoutRef.current);
      }

      try {
        const dataResponse = await startMutation.mutateAsync({ emailAddress: email, scooterId, pricePerThousand, currency });
        logTs('[Orchestrator handleStartRide] Start success.', dataResponse);
        
        // Don't show unlock success message yet - wait for initialization to complete
        storeReset();
        lastBucketRef.current = 0;
        const startTimeFromServer = dataResponse.startedAt ? new Date(dataResponse.startedAt).getTime() : Date.now();
        workflowApi.setRideStartTime(startTimeFromServer);
        workflowApi.setIsRideActiveState(true);
        storeSetIsAnimating(true);
        storeSetMovementDisabledMessage(null);
        workflowApi.setShowSummary(false);
        workflowApi.setInternalWorkflowId(dataResponse.workflowId);
        storeSetWorkflowId(dataResponse.workflowId);
        if (navigate) {
          navigate(`/ride/${dataResponse.workflowId}`, { replace: true });
        }
      } catch (error: any) {
        logTs('[Orchestrator handleStartRide] Start error.', error);
        let finalErrorMessageToShow: string;

        // Check for the specific "Activity task failed" message to override it
        if (error.message?.includes('Activity task failed')) {
          finalErrorMessageToShow = 'The email address provided is invalid or could not be processed. Please check and try again.';
        } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          finalErrorMessageToShow = 'Unable to connect to the server. Please check if the API is running.';
        } else {
          finalErrorMessageToShow = error.message || 'Failed to start ride. Please try again.';
        }

        workflowApi.showTemporaryError(finalErrorMessageToShow);
        
        storeSetIsAnimating(false);
        storeSetMovementDisabledMessage('Unable to start ride. Please try again.'); // This message is for movement restriction
        workflowApi.setShowSummary(false);
        setUnlockSuccessMessageActive(false); 
        if (unlockMessageTimeoutRef.current) {
            clearTimeout(unlockMessageTimeoutRef.current);
            unlockMessageTimeoutRef.current = null;
        }
      }
    }
  }, [
    email, scooterId, startMutation, validateEmailUtil, validateScooterIdUtil, setEmailError, setScooterIdError,
    workflowApi, storeReset, storeSetIsAnimating, storeSetMovementDisabledMessage, storeSetWorkflowId, navigate,
    // No need to add setUnlockSuccessMessageActive to deps for useCallback itself, it's a local setter
  ]);

  // Effect to show unlock success message only after successful initialization
  useEffect(() => {
    const currentPhase = rideStateDataForWorkflow?.status?.phase;
    const wasInitializing = isInitializing;
    
    // If we were initializing and now we're active, show the success message
    if (wasInitializing && currentPhase === 'ACTIVE') {
      setUnlockSuccessMessageActive(true);
      if (unlockMessageTimeoutRef.current) {
        clearTimeout(unlockMessageTimeoutRef.current);
      }
      unlockMessageTimeoutRef.current = setTimeout(() => {
        setUnlockSuccessMessageActive(false);
        unlockMessageTimeoutRef.current = null;
      }, 3000);
    }
  }, [rideStateDataForWorkflow?.status?.phase, isInitializing]);

  // Effect to clear unlock message if initialization fails
  useEffect(() => {
    const currentPhase = rideStateDataForWorkflow?.status?.phase;
    if (currentPhase === 'FAILED' && unlockSuccessMessageActive) {
      setUnlockSuccessMessageActive(false);
      if (unlockMessageTimeoutRef.current) {
        clearTimeout(unlockMessageTimeoutRef.current);
        unlockMessageTimeoutRef.current = null;
      }
    }
  }, [rideStateDataForWorkflow?.status?.phase]);

  const handleEndRide = useCallback(async () => {
    logTs(`[Orchestrator handleEndRide] Called. internalWorkflowId: ${workflowApi.internalWorkflowId}`);
    if (workflowApi.internalWorkflowId) {
      endingRef.current = true;
      workflowApi.setIsRideActiveState(false);
      storeSetIsAnimating(false);
      try {
        await endMutation.mutateAsync();
        logTs('[Orchestrator handleEndRide] End success for workflow:', workflowApi.internalWorkflowId);
        endingRef.current = false;
      } catch (error: any) {
        logTs('[Orchestrator handleEndRide] End error.', error);
        endingRef.current = false;
        workflowApi.showTemporaryError(error.message || 'Failed to end ride');
        workflowApi.setShowSummary(false);
      }
    } else {
      workflowApi.showTemporaryError('No active ride to end.');
    }
  }, [workflowApi, endMutation, storeSetIsAnimating]);

  // Effect for sending distance updates
  useEffect(() => {
    if (!workflowApi.isRideActiveState || storeDistance <= 0 || !workflowApi.internalWorkflowId) {
      if (storeDistance === 0) {
        lastBucketRef.current = 0;
      }
      return;
    }
    const currentBucket = Math.floor(storeDistance / 100);
    const previousBucket = lastBucketRef.current;
    if (currentBucket > previousBucket) {
      logTs(`[Orchestrator addDistance] Mutating for buckets ${previousBucket + 1} to ${currentBucket}.`);
      for (let i = previousBucket + 1; i <= currentBucket; i++) {
        addDistanceMutation.mutate(undefined, {
            onError: (error: any) => {
                 logTs('[Orchestrator addDistance] Failed to add distance.', error);
                 workflowApi.showTemporaryError(error.message || 'Failed to add distance');
            }
        });
      }
      lastBucketRef.current = currentBucket;
    }
  }, [storeDistance, workflowApi.isRideActiveState, workflowApi.internalWorkflowId, addDistanceMutation, workflowApi]);

  // 10. Deriving a user-friendly ride status message
  const rideStatusMessage = useMemo(() => {
    let msg = "Enter your email and unlock the scooter to start your ride.";
    if (workflowApi.errorMessage) { 
      msg = ""; 
    } else if (unlockSuccessMessageActive) { 
      msg = "Scooter Unlocked! Get ready to ride.";
    } else if (startMutation.isPending) {
      msg = "Unlocking scooter...";
    } else if (endMutation.isPending || endingRef.current) {
      msg = "Ending ride...";
    } else if (isLoadingRideState && !!workflowApi.internalWorkflowId && !workflowApi.isRideActiveState && !workflowApi.showSummary) {
      msg = `Loading ride state for ${workflowApi.internalWorkflowId}...`;
    } else if (workflowApi.isRideActiveState) {
      const currentPhase = rideStateDataForWorkflow?.status?.phase; 
      if (currentPhase === 'INITIALIZING') {
          msg = "Initializing ride...";
      } else if (currentPhase === 'BLOCKED') {
          msg = "Ride blocked. Check for messages."; 
      } else {
          msg = "Ride in progress. Use the right arrow key on your keyboard to move.";
      }
    } else if (workflowApi.showSummary) {
      if (rideStateDataForWorkflow?.status?.phase === 'ENDED') {
        msg = "Ride ended.";
      } else if (rideStateDataForWorkflow?.status?.phase === 'TIMED_OUT') {
        msg = "Ride timed out.";
      } else if (workflowApi.internalWorkflowId) {
        msg = `Loading summary for ${workflowApi.internalWorkflowId}...`;
      } else {
        msg = "Summary displayed."; 
      }
    } else if (rideStateDataForWorkflow?.status?.phase === 'FAILED') { 
      if (!workflowApi.errorMessage) { 
        msg = "Ride attempt failed. Please check details below.";
      } else {
        msg = ""; 
      }
    } else if (workflowApi.internalWorkflowId && !workflowApi.isRideActiveState && !workflowApi.showSummary) {
      if (storeTokens > 0) { 
        msg = "Previous ride loaded. Unlock scooter to start a new ride.";
      } else {
        msg = `Ride ${workflowApi.internalWorkflowId} loaded. Ready to start or resume.`;
      }
    }
    return msg;
  }, [
      workflowApi.errorMessage, workflowApi.internalWorkflowId, workflowApi.isRideActiveState, workflowApi.showSummary,
      unlockSuccessMessageActive, 
      startMutation.isPending, endMutation.isPending, isLoadingRideState,
      rideStateDataForWorkflow, 
      storeTokens
  ]);

  // Effect to track initialization state
  useEffect(() => {
    const isInitializingPhase = rideStateDataForWorkflow?.status?.phase === 'INITIALIZING';
    setIsInitializing(isInitializingPhase);
  }, [rideStateDataForWorkflow?.status?.phase]);

  // 11. Effect for cleanup on component unmount
  useEffect(() => {
    logTs(`[Orchestrator Mount] Component/hook mounted.`);
    return () => {
      logTs(`[Orchestrator Unmount] Unmounting.`);
      if (unlockMessageTimeoutRef.current) {
        clearTimeout(unlockMessageTimeoutRef.current); 
      }
    };
  }, []);

  return {
    email, setEmail, emailError, setEmailError,
    scooterId, setScooterId, scooterIdError, setScooterIdError,
    isRideActive: workflowApi.isRideActiveState,
    rideStateData: rideStateDataForWorkflow, 
    isLoadingRideState: isLoadingRideState || (startMutation.isPending && !workflowApi.internalWorkflowId),
    showSummary: workflowApi.showSummary,
    errorMessage: workflowApi.errorMessage,
    rideStatusMessage,
    storeDistance,
    storeElapsed,
    storeTokens,
    internalWorkflowId: workflowApi.internalWorkflowId,
    startMutation,
    endMutation,
    handleStartRide,
    handleEndRide,
    dismissSummaryAndReset: workflowApi.dismissSummaryAndReset,
    validateEmailUtil,
    validateScooterIdUtil,
    isStarting: startMutation.isPending || isInitializing, // Modified to include initialization state
  };
};
