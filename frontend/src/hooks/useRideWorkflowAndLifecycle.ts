import { useState, useEffect, useRef, useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { logTs, isActivePhase } from './rideOrchestrator.utils';
import type { RideStateResponse } from './rideOrchestrator.types'; // Ensure this path is correct
import { calculateElapsedSeconds, fmtTime } from '../utils/timeUtils';

export interface UseRideWorkflowAndLifecycleProps {
  workflowIdFromUrl?: string | null;
  navigate?: NavigateFunction;
  // Store access
  storeWorkflowId: string | null;
  storeSetWorkflowId: (id: string | null) => void;
  storeReset: () => void;
  storeSetTokens: (tokens: number) => void;
  storeSetElapsed: (elapsed: string) => void;
  storeSetMovementDisabledMessage: (message: string | null) => void;
  storeSetIsAnimating: (isAnimating: boolean) => void;
  // From poller
  rideStateData: RideStateResponse | null | undefined;
  refetchRideState: () => void;
  // From mutations
  isStartMutationPending: boolean;
  // For resetting inputs
  resetInputFields: () => void;
}

/**
 * Custom hook managing workflow ID, ride lifecycle states, and related effects.
 */
export const useRideWorkflowAndLifecycle = (props: UseRideWorkflowAndLifecycleProps) => {
  const {
    workflowIdFromUrl, navigate,
    storeWorkflowId, storeSetWorkflowId, storeReset,
    storeSetTokens, storeSetElapsed, storeSetMovementDisabledMessage, storeSetIsAnimating,
    rideStateData, refetchRideState,
    isStartMutationPending,
    resetInputFields,
  } = props;

  // Workflow ID state
  const [internalWorkflowId, setInternalWorkflowIdState] = useState<string | null>(
    workflowIdFromUrl || storeWorkflowId
  );
  // Refs for managing state related to dismissing the summary and URL synchronization
  const previousWorkflowIdOnDismissRef = useRef<string | null | undefined>(null);
  const justDismissedFlagRef = useRef(false);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Lifecycle state
  const [isRideActiveState, setIsRideActiveState] = useState(false);
  const [rideStartTime, setRideStartTime] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [errorMessage, setErrorMessageState] = useState<string | null>(null); // General error message state
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false);
  const [initializingStartTime, setInitializingStartTime] = useState<number | null>(null);
  const INITIALIZING_TIMEOUT_MS = 3000; // 3 seconds
  const INITIALIZING_CHECK_INTERVAL_MS = 500; // Interval for checking the initialization timeout
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined); // Timeout for clearing general error messages

  /**
   * Stable setter for the general error message.
   */
  const setErrorMessage = useCallback((message: string | null) => {
    setErrorMessageState(message);
  }, []);
  
  /**
   * Stable setter for the internal workflow ID.
   */
  const setInternalWorkflowId = useCallback((id: string | null) => {
    setInternalWorkflowIdState(id);
  }, []);


  // Effect to synchronize with workflowId from URL parameters
  useEffect(() => {
    logTs(`[WL&L workflowIdFromUrl] START. workflowIdFromUrl: ${workflowIdFromUrl}, internalWorkflowId: ${internalWorkflowId}, startPending: ${isStartMutationPending}, justDismissed: ${justDismissedFlagRef.current}`);
    if (workflowIdFromUrl) {
      if (justDismissedFlagRef.current && workflowIdFromUrl === previousWorkflowIdOnDismissRef.current) {
        logTs(`[WL&L workflowIdFromUrl] Ignoring stale workflowIdFromUrl (${workflowIdFromUrl}) immediately after dismissal.`);
        return;
      }
      if (workflowIdFromUrl !== internalWorkflowId) {
        logTs(`[WL&L workflowIdFromUrl] URL has workflowId ${workflowIdFromUrl}, current internal is ${internalWorkflowId}. Resetting and loading from URL.`);
        storeReset();
        setInternalWorkflowId(workflowIdFromUrl); 
        storeSetWorkflowId(workflowIdFromUrl);
        refetchRideState();
        if (justDismissedFlagRef.current) {
          justDismissedFlagRef.current = false;
          previousWorkflowIdOnDismissRef.current = null;
          if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
          logTs(`[WL&L workflowIdFromUrl] Cleared dismissal flags.`);
        }
      }
    } else { 
      if (internalWorkflowId && !justDismissedFlagRef.current && !isStartMutationPending) {
        logTs(`[WL&L workflowIdFromUrl] URL cleared, internalWorkflowId (${internalWorkflowId}) was set. Conditions met for reset (not pending start). Resetting internal state.`);
        storeReset();
        setInternalWorkflowId(null); 
        storeSetWorkflowId(null);
      } else {
        logTs(`[WL&L workflowIdFromUrl] URL cleared, but conditions for reset not met. internalWorkflowId: ${internalWorkflowId}, justDismissed: ${justDismissedFlagRef.current}, startPending: ${isStartMutationPending}`);
      }
    }
    logTs(`[WL&L workflowIdFromUrl] END.`);
  }, [workflowIdFromUrl, internalWorkflowId, storeReset, storeSetWorkflowId, refetchRideState, isStartMutationPending, setInternalWorkflowId]);

  // Effect to synchronize with workflowId from the Zustand store
  useEffect(() => {
    logTs(`[WL&L storeWorkflowId] START. storeWorkflowId: ${storeWorkflowId}, internalWorkflowId: ${internalWorkflowId}`);
    if (storeWorkflowId && storeWorkflowId !== internalWorkflowId) {
      logTs(`[WL&L storeWorkflowId] storeWorkflowId (${storeWorkflowId}) changed and differs from internal (${internalWorkflowId}). Syncing internal.`);
      setInternalWorkflowId(storeWorkflowId); 
    } else if (!storeWorkflowId && internalWorkflowId && !isStartMutationPending) {
      logTs(`[WL&L storeWorkflowId] storeWorkflowId cleared, but internalWorkflowId (${internalWorkflowId}) was set and not pending start. Resetting.`);
      storeReset();
      setInternalWorkflowId(null); 
    }
    logTs(`[WL&L storeWorkflowId] END.`);
  }, [storeWorkflowId, internalWorkflowId, storeReset, setInternalWorkflowId, isStartMutationPending]);

  /**
   * Shows a temporary general error message.
   */
  const showTemporaryError = useCallback((message: string) => {
    logTs(`[WL&L showTemporaryError] Called. Current errorMessage: "${errorMessage}". New message: "${message}"`);
    setErrorMessageState(message); // Sets the general errorMessage
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    const isInitializing = rideStateData?.status?.phase === 'INITIALIZING';
    if (!isInitializing) { // Don't auto-clear if it's an initializing timeout message
      errorTimeoutRef.current = setTimeout(() => {
        setErrorMessageState(null);
      }, 5000);
    }
  }, [rideStateData?.status?.phase, errorMessage]); 

  // Effect to reset ride-specific timers and flags when internalWorkflowId changes
  useEffect(() => {
    logTs(`[WL&L internalWorkflowId change] START. internalWorkflowId: ${internalWorkflowId}. Resetting ride timers/flags.`);
    setRideStartTime(null);
    setInitializingStartTime(null);
    setIsRequestTimedOut(false);
    // Do not clear errorMessage here automatically on internalWorkflowId change,
    // as it might have been set by a mutation error before workflowId is established.
    // It will be cleared by its own timeout or specific conditions (e.g. ride becoming active or reset).
    if (errorTimeoutRef.current) { // Clear timeout for general error if workflow changes
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = undefined;
    }
    if (!internalWorkflowId) { // If workflowId is explicitly nulled (e.g. on reset/dismiss)
      setIsRideActiveState(false);
      setShowSummary(false);
      setErrorMessageState(null); // Clear general error message
    }
    logTs(`[WL&L internalWorkflowId change] END. rideStartTime: null, initializingStartTime: null, isRequestTimedOut: false.`);
  }, [internalWorkflowId]);

  // Main effect to process data from the poller (rideStateData)
  useEffect(() => {
    logTs(`[WL&L rideStateData] START. internalWorkflowId: ${internalWorkflowId}, fullRideStateData:`, rideStateData);

    if (!internalWorkflowId) {
      if (showSummary) setShowSummary(false);
      logTs(`[WL&L rideStateData] END (no internalWorkflowId).`);
      return;
    }

    if (rideStateData && rideStateData.status) {
      const serverPhase = rideStateData.status.phase;
      const lastErrorFromApi = rideStateData.status.lastError; // Capture lastError from API
      logTs(`[WL&L rideStateData] Processing rideStateData. ServerPhase: ${serverPhase}, LastError: ${lastErrorFromApi}`);

      const isActiveFromServer = isActivePhase(serverPhase);
      const isInitializing = serverPhase === 'INITIALIZING';
      const isFailed = serverPhase === 'FAILED';
      const isTimedOut = serverPhase === 'TIMED_OUT';
      const isEnded = serverPhase === 'ENDED' || isTimedOut;

      if (isInitializing && !initializingStartTime) {
        setInitializingStartTime(Date.now());
      } else if (!isInitializing && initializingStartTime) {
        setInitializingStartTime(null);
        if (!isFailed && isRequestTimedOut) { // Reset timedOut flag if no longer initializing and not failed
          setIsRequestTimedOut(false);
        }
      }
      
      if (isRideActiveState !== isActiveFromServer) setIsRideActiveState(isActiveFromServer);

      if (isInitializing) {
        storeSetMovementDisabledMessage('Starting your ride...');
      } else if (serverPhase === 'BLOCKED') {
        storeSetMovementDisabledMessage('Approve ride signal required to continue');
      } else if (isFailed) {
        // If the phase is FAILED, check for the specific "Activity task failed" error
        if (lastErrorFromApi?.toLowerCase().includes('activity task failed')) {
          storeSetMovementDisabledMessage('The email address provided is invalid or could not be processed. Please check and try again.');
          logTs('[WL&L rideStateData] FAILED state with "Activity task failed" from API. Setting custom movement disabled message.');
        } else {
          // For other FAILED reasons, use the API's lastError or a more generic failure message
          storeSetMovementDisabledMessage(lastErrorFromApi || 'Ride failed. Please try again.');
        }
      } else if (isTimedOut) {
        storeSetMovementDisabledMessage('Ride timed out. Unlock to start a new session.');
      } else if (isEnded) {
        storeSetMovementDisabledMessage('Ride ended. Unlock to start a new session.');
      } else {
        // For all other phases (ACTIVE, etc.)
        // If there's a lastError from the API, display it. Otherwise, clear the movement message.
        storeSetMovementDisabledMessage(lastErrorFromApi || null);
      }

      const canAnimate = isActiveFromServer && !isInitializing && serverPhase !== 'BLOCKED';
      storeSetIsAnimating(canAnimate);

      // Clear lingering general errorMessage (from showTemporaryError) if ride is now active and not blocked
      if (isActiveFromServer && serverPhase !== 'BLOCKED' && errorMessage) {
        setErrorMessageState(null);
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      }

      if (isActiveFromServer && rideStateData.status.startedAt) {
        const serverStartTimeMs = new Date(rideStateData.status.startedAt).getTime();
        if (rideStartTime !== serverStartTimeMs) setRideStartTime(serverStartTimeMs);
      } else if (!isActiveFromServer && rideStartTime !== null) {
        setRideStartTime(null);
      }

      if (isEnded) {
        if (!showSummary) setShowSummary(true);
        let finalElapsedSeconds = 0;
        if (rideStateData.status.startedAt) {
          finalElapsedSeconds = calculateElapsedSeconds(rideStateData.status.startedAt, rideStateData.status.endedAt);
        }
        storeSetElapsed(fmtTime(finalElapsedSeconds));
      } else if (isFailed) {
        if (showSummary) setShowSummary(false); // Don't show summary if ride failed
        if (isRequestTimedOut) setIsRequestTimedOut(false); // Reset timeout if it failed
        let finalElapsedSeconds = 0;
        if (rideStateData.status.startedAt && rideStateData.status.endedAt) {
             finalElapsedSeconds = calculateElapsedSeconds(rideStateData.status.startedAt, rideStateData.status.endedAt);
        } else if (rideStateData.status.startedAt) { // If it started but then failed
            finalElapsedSeconds = calculateElapsedSeconds(rideStateData.status.startedAt, undefined); // Current time if only startedAt
        }
        storeSetElapsed(fmtTime(finalElapsedSeconds));
        // Note: The general errorMessage might have been set by handleStartRide's catch block in orchestrator.
        // The storeMovementDisabledMessage is handled above for FAILED state.
      } else { // For active, initializing, etc., not ended or failed
        if (showSummary) setShowSummary(false);
      }

      storeSetTokens(rideStateData.status.tokens?.total || 0);

    } else {
      logTs(`[WL&L rideStateData] No rideStateData or no rideStateData.status. internalWorkflowId: ${internalWorkflowId}`);
    }
    logTs(`[WL&L rideStateData] END. showSummary: ${showSummary}, isRideActiveState: ${isRideActiveState}, errorMessage: ${errorMessage}`);
  }, [
    internalWorkflowId, rideStateData,
    storeSetTokens, storeSetElapsed, storeSetMovementDisabledMessage, storeSetIsAnimating,
    rideStartTime, initializingStartTime, isRequestTimedOut, errorMessage, showSummary, isRideActiveState,
    setRideStartTime, setIsRideActiveState, setShowSummary, setInitializingStartTime, setIsRequestTimedOut, setErrorMessageState, 
  ]);

  // Dedicated effect for INITIALIZING timeout check
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined = undefined;
    const currentPhaseIsInitializing = rideStateData?.status?.phase === 'INITIALIZING';

    if (currentPhaseIsInitializing && initializingStartTime && !isRequestTimedOut) {
      intervalId = setInterval(() => {
        // Check isRequestTimedOut again inside interval, as it might be set by another effect or callback
        if (!isRequestTimedOut) { 
            const elapsedTime = Date.now() - initializingStartTime;
            if (elapsedTime > INITIALIZING_TIMEOUT_MS) {
              // This uses showTemporaryError, which sets the general errorMessage state
              showTemporaryError('Ride initialization is taking a while.. please wait a moment.');
              setIsRequestTimedOut(true); // Mark that this specific timeout has occurred
              if (intervalId) clearInterval(intervalId);
            }
        } else { // If already timed out, clear interval
             if (intervalId) clearInterval(intervalId);
        }
      }, INITIALIZING_CHECK_INTERVAL_MS);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [rideStateData?.status?.phase, initializingStartTime, isRequestTimedOut, showTemporaryError, setIsRequestTimedOut, INITIALIZING_TIMEOUT_MS, INITIALIZING_CHECK_INTERVAL_MS]);

  /**
   * Dismisses the ride summary and resets all ride-related state.
   */
  const dismissSummaryAndReset = useCallback((forceResetDueToError = false) => {
    logTs(`[WL&L dismissSummaryAndReset] Called. internalWorkflowId: ${internalWorkflowId}, forceResetDueToError: ${forceResetDueToError}`);
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
    resetInputFields(); 
    setErrorMessageState(null); // Clear general error message on reset
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current); // Clear its timeout as well
    
    logTs(`[WL&L dismissSummaryAndReset] State reset. Setting dismiss timeout.`);

    dismissTimeoutRef.current = setTimeout(() => {
      logTs("[WL&L dismissSummaryAndReset] Dismiss timeout FIRED. Clearing flags.");
      justDismissedFlagRef.current = false;
      previousWorkflowIdOnDismissRef.current = null;
      dismissTimeoutRef.current = undefined;
    }, 200);

  }, [navigate, storeReset, storeSetWorkflowId, internalWorkflowId, setInternalWorkflowId, resetInputFields]);

  // Effect for cleanup on component unmount
  useEffect(() => {
    return () => {
      logTs(`[WL&L Unmount] Unmounting. Clearing timeouts.`);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      // No need to clear initializing timeout here, its own effect handles it.
    };
  }, []);

  return {
    // State
    internalWorkflowId,
    isRideActiveState,
    rideStartTime,
    showSummary,
    errorMessage, // The general error message state (set by showTemporaryError)
    isRequestTimedOut,
    // Setters / Actions
    setInternalWorkflowId, 
    setIsRideActiveState,
    setRideStartTime,
    setShowSummary,
    setErrorMessage, // The stable setter for the general errorMessage state
    setIsRequestTimedOut,
    showTemporaryError, // The function to call to show a temporary general error
    dismissSummaryAndReset,
  };
};
