import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useRideStore } from '../stores/rideStore';
import { useRideTimer } from './useRideTimer';
import { useRideMutations } from './useRideMutations'; // Assuming this is the original
import { useRideStatePoller } from './useRideStatePoller';
import { fmtTime } from '../utils/timeUtils';
import type { NavigateFunction } from 'react-router-dom';
import { logTs } from './rideOrchestrator.utils';
import { useRideInputs } from './useRideInputs';
import { useRideWorkflowAndLifecycle } from './useRideWorkflowAndLifecycle';

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

  // 3. Refs used by mutation callbacks and effects
  const lastBucketRef = useRef(0);
  const endingRef = useRef(false); // To track if endMutation is in progress via its own callback

  // 4. Mutations Hook
  //    internalWorkflowId for mutations will be taken from workflowApi.internalWorkflowId.
  //    We need a state variable to pass to useRideMutations that updates when workflowApi.internalWorkflowId changes.
  const [mutationWorkflowId, setMutationWorkflowId] = useState<string | null>(workflowIdFromUrl || storeWorkflowId);

  const {
    startMutation,
    endMutation,
    addDistanceMutation
  } = useRideMutations({ // This is the original useRideMutations hook
    workflowId: mutationWorkflowId, // Pass the state variable
    validateEmailFn: validateEmailUtil,
    validateScooterIdFn: validateScooterIdUtil,
    // Callbacks are defined below, using workflowApi setters
    // For now, pass stubs or handle them outside if useRideMutations returns promises
    // The original useRideMutations took callbacks directly. We will define them using workflowApi.
    // This means workflowApi must be initialized before these callbacks are effectively used by useRideMutations.
    // The simplest is to ensure workflowApi is initialized, then define these callbacks.
    // For this refactor, we'll assume the callbacks are passed and useRideMutations handles them.
    // The actual setters will come from workflowApi defined shortly.
    // This part requires careful wiring: the callbacks passed to useRideMutations
    // need to call methods on workflowApi.
    onStartSuccess: (dataResponse) => {
        // This will be redefined later using workflowApi
        logTs('[Orchestrator onStartSuccess] Placeholder. Actual logic will use workflowApi.', dataResponse);
    },
    onStartError: (error: Error) => {
        logTs('[Orchestrator onStartError] Placeholder.', error);
    },
    onEndMutate: () => {
        logTs('[Orchestrator onEndMutate] Placeholder.');
        endingRef.current = true; // Original logic
        // setIsRideActiveState(false) & storeSetIsAnimating(false) will be workflowApi calls
    },
    onEndSuccess: () => {
        logTs('[Orchestrator onEndSuccess] Placeholder.');
        endingRef.current = false; // Original logic
    },
    onEndError: (error: Error) => {
        logTs('[Orchestrator onEndError] Placeholder.', error);
        endingRef.current = false; // Original logic
    },
    onAddDistanceError: (error: Error) => {
        logTs('[Orchestrator onAddDistanceError] Placeholder.', error);
    },
  });


  // 5. Poller Hook
  //    internalWorkflowId for poller, and its enabled state, will also come from workflowApi.
  const [pollerWorkflowId, setPollerWorkflowId] = useState<string | null>(workflowIdFromUrl || storeWorkflowId);
  const [pollerEnabledState, setPollerEnabledState] = useState(false);
  const {
    data: rideStateData, // This is the polled data
    isLoading: isLoadingRideState,
    refetch: refetchRideState
  } = useRideStatePoller(pollerWorkflowId, pollerEnabledState);

  // Prepare rideStateData for useRideWorkflowAndLifecycle
  // It expects RideStateResponse from './rideOrchestrator.types' which includes workflowId
  const rideStateDataForWorkflow = useMemo(() => {
    if (rideStateData && pollerWorkflowId) {
      return {
        ...rideStateData, // Spread the polled data (from api/rideApi)
        workflowId: pollerWorkflowId, // Add the workflowId known to the poller
      };
    }
    // Ensure the return type matches RideStateResponse | null | undefined
    // If rideStateData is undefined, or pollerWorkflowId is null, return undefined (or null)
    // to match the expected type for useRideWorkflowAndLifecycle.
    // Given rideStateData is `RideStateResponse | undefined` and pollerWorkflowId is `string | null`,
    // this condition correctly handles cases where either is not set.
    return undefined;
  }, [rideStateData, pollerWorkflowId]);


  // 6. Workflow and Lifecycle Hook
  const workflowApi = useRideWorkflowAndLifecycle({
    workflowIdFromUrl,
    navigate,
    // Store access
    storeWorkflowId, storeSetWorkflowId, storeReset,
    storeSetTokens, storeSetElapsed, storeSetMovementDisabledMessage, storeSetIsAnimating,
    // From poller
    rideStateData: rideStateDataForWorkflow, // Pass the transformed data
    refetchRideState, // Pass the refetch function
    // From mutations
    isStartMutationPending: startMutation.isPending,
    // For resetting inputs
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
    logTs(`[Orchestrator pollerEnabled effect] Poller enabled: ${enabled}`);
  }, [workflowApi.internalWorkflowId, workflowApi.isRideActiveState, startMutation.isPending, endMutation.isPending, workflowApi.showSummary]);


  // Define actual mutation callbacks using workflowApi
  // Note: This redefines the callbacks for useRideMutations.
  // Ideally, useRideMutations would be structured to accept these dynamically or return promises.
  // For this refactor, we assume that if useRideMutations is called again with new callbacks, it uses them.
  // Or, more simply, the onStartSuccess etc. props of useRideMutations are themselves functions that close over workflowApi.
  // The original hook defines these callbacks inline, so they have access to the hook's scope.
  // We need to ensure these callbacks, when invoked by useRideMutations, correctly call workflowApi methods.

  // This part is tricky. If useRideMutations is a black box that takes callbacks only on init,
  // then those initial (placeholder) callbacks won't have workflowApi.
  // A common pattern is for mutation hooks to return promise-based functions.
  // Let's assume `startMutation.mutateAsync()` returns a promise and we handle success/error here.
  // If `useRideMutations` strictly uses its `onStartSuccess` prop, then that prop needs to be a stable function
  // that internally accesses the latest `workflowApi` (e.g., via a ref or by being part of a re-memoized options object).

  // For simplicity, let's define handlers that call mutateAsync and then use workflowApi.
  // This bypasses the onXXX props of useRideMutations if they are not designed for this.

  // 7. Ride Timer
  const localElapsedSeconds = useRideTimer(workflowApi.isRideActiveState, workflowApi.rideStartTime);

  // Effect to update the elapsed time in the Zustand store
  useEffect(() => {
    storeSetElapsed(fmtTime(localElapsedSeconds));
  }, [localElapsedSeconds, storeSetElapsed]);


  // 8. Action Handlers (replaces direct use of mutation hook's onXXX callbacks)
  const handleStartRide = useCallback(async () => {
    logTs(`[Orchestrator handleStartRide] Called. Email: ${email}, ScooterID: ${scooterId}`);
    const emailVal = validateEmailUtil(email);
    const scooterIdVal = validateScooterIdUtil(scooterId);

    setEmailError(emailVal.error || '');
    setScooterIdError(scooterIdVal.error || '');

    if (emailVal.isValid && scooterIdVal.isValid) {
      logTs(`[Orchestrator handleStartRide] Inputs valid. Calling startMutation.`);
      const pricePerThousand = 25;
      const currency = "USD";
      workflowApi.setErrorMessage(null); // From workflowApi
      workflowApi.setIsRequestTimedOut(false); // From workflowApi
      try {
        const dataResponse = await startMutation.mutateAsync({ emailAddress: email, scooterId, pricePerThousand, currency });
        // Original onStartSuccess logic:
        logTs('[Orchestrator handleStartRide] Start success.', dataResponse);
        storeReset();
        lastBucketRef.current = 0;
        const startTimeFromServer = dataResponse.startedAt ?? Date.now();
        workflowApi.setRideStartTime(startTimeFromServer);
        workflowApi.setIsRideActiveState(true);
        storeSetIsAnimating(true); // Directly from store
        storeSetMovementDisabledMessage(null); // Directly from store
        workflowApi.setShowSummary(false);
        workflowApi.setInternalWorkflowId(dataResponse.workflowId); // Update workflow via API
        storeSetWorkflowId(dataResponse.workflowId); // Sync store
        if (navigate) {
          navigate(`/ride/${dataResponse.workflowId}`, { replace: true });
        }
      } catch (error: any) {
        // Original onStartError logic:
        logTs('[Orchestrator handleStartRide] Start error.', error);
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          workflowApi.showTemporaryError('Unable to connect to the server. Please check if the API is running.');
        } else {
          workflowApi.showTemporaryError(error.message || 'Failed to start ride');
        }
        storeSetIsAnimating(false);
        storeSetMovementDisabledMessage('Unable to start ride. Please try again.');
        workflowApi.setShowSummary(false);
      }
    }
  }, [
    email, scooterId, startMutation, validateEmailUtil, validateScooterIdUtil, setEmailError, setScooterIdError,
    workflowApi, storeReset, storeSetIsAnimating, storeSetMovementDisabledMessage, storeSetWorkflowId, navigate
  ]);

  const handleEndRide = useCallback(async () => {
    logTs(`[Orchestrator handleEndRide] Called. internalWorkflowId: ${workflowApi.internalWorkflowId}`);
    if (workflowApi.internalWorkflowId) {
      // Original onEndMutate logic
      endingRef.current = true;
      workflowApi.setIsRideActiveState(false);
      storeSetIsAnimating(false);
      try {
        await endMutation.mutateAsync();
        // Original onEndSuccess logic
        logTs('[Orchestrator handleEndRide] End success for workflow:', workflowApi.internalWorkflowId);
        endingRef.current = false;
        // Ride summary is shown by poller detecting 'ENDED' phase via workflowApi's effect
      } catch (error: any) {
        // Original onEndError logic
        logTs('[Orchestrator handleEndRide] End error.', error);
        endingRef.current = false;
        workflowApi.showTemporaryError(error.message || 'Failed to end ride');
        workflowApi.setShowSummary(false); // Ensure summary isn't shown on error
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
        addDistanceMutation.mutate(undefined, { // Pass undefined if no args, add error handling if needed
            onError: (error: any) => {
                 logTs('[Orchestrator addDistance] Failed to add distance.', error);
                 workflowApi.showTemporaryError(error.message || 'Failed to add distance');
            }
        });
      }
      lastBucketRef.current = currentBucket;
    }
  }, [storeDistance, workflowApi.isRideActiveState, workflowApi.internalWorkflowId, addDistanceMutation, workflowApi.showTemporaryError]);

  // 9. Deriving a user-friendly ride status message
  const rideStatusMessage = useMemo(() => {
    let msg = "Enter your email and unlock the scooter to start your ride.";
    if (workflowApi.errorMessage) {
      msg = "";
    } else if (startMutation.isPending) {
      msg = "Unlocking scooter...";
    } else if (endMutation.isPending || endingRef.current) { // Use endingRef for immediate feedback
      msg = "Ending ride...";
    } else if (isLoadingRideState && !!workflowApi.internalWorkflowId && !workflowApi.isRideActiveState && !workflowApi.showSummary) {
      msg = `Loading ride state for ${workflowApi.internalWorkflowId}...`;
    } else if (workflowApi.isRideActiveState) {
      const currentPhase = rideStateData?.status?.phase;
      if (currentPhase === 'INITIALIZING') {
          msg = "Initializing ride...";
      } else if (currentPhase === 'BLOCKED') {
          msg = "Ride blocked. Check for messages.";
      } else {
          msg = "Ride in progress. Use the right arrow key on your keyboard to move.";
      }
    } else if (workflowApi.showSummary) {
      if (rideStateData?.status?.phase === 'ENDED') {
        msg = "Ride ended.";
      } else if (workflowApi.internalWorkflowId) {
        msg = `Loading summary for ${workflowApi.internalWorkflowId}...`;
      } else {
        msg = "Summary displayed.";
      }
    } else if (rideStateData?.status?.phase === 'FAILED') {
      if (!workflowApi.errorMessage) {
        msg = "Ride attempt failed. Please check details below.";
      } else {
        msg = "";
      }
    } else if (workflowApi.internalWorkflowId && !workflowApi.isRideActiveState && !workflowApi.showSummary) {
      if (storeTokens > 0) {
        msg = "Previous ride loaded. Unlock scooter to start a new ride.";
      }
    }
    return msg;
  }, [
      workflowApi.errorMessage, workflowApi.internalWorkflowId, workflowApi.isRideActiveState, workflowApi.showSummary,
      startMutation.isPending, endMutation.isPending, isLoadingRideState, rideStateData, storeTokens
  ]);

  // 10. Effect for cleanup on component unmount (Main orchestrator specific, if any)
  useEffect(() => {
    logTs(`[Orchestrator Mount] Component/hook mounted.`);
    return () => {
      logTs(`[Orchestrator Unmount] Unmounting.`);
      // Cleanup for this hook itself, sub-hooks handle their own internal timeouts.
    };
  }, []);

  return {
    email, setEmail, emailError, setEmailError,
    scooterId, setScooterId, scooterIdError, setScooterIdError,
    isRideActive: workflowApi.isRideActiveState,
    rideStateData, // From poller
    isLoadingRideState: isLoadingRideState || (startMutation.isPending && !workflowApi.internalWorkflowId),
    showSummary: workflowApi.showSummary,
    errorMessage: workflowApi.errorMessage,
    rideStatusMessage,
    storeDistance,
    storeElapsed,
    storeTokens,
    internalWorkflowId: workflowApi.internalWorkflowId,
    startMutation, // Expose the mutation objects
    endMutation,
    handleStartRide,
    handleEndRide,
    dismissSummaryAndReset: workflowApi.dismissSummaryAndReset,
    validateEmailUtil,
    validateScooterIdUtil,
  };
};