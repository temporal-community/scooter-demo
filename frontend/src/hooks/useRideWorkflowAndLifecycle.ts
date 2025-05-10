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
  const [errorMessage, setErrorMessageState] = useState<string | null>(null);
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false);
  const [initializingStartTime, setInitializingStartTime] = useState<number | null>(null);
  const INITIALIZING_TIMEOUT_MS = 3000; // 3 seconds
  const INITIALIZING_CHECK_INTERVAL_MS = 500; // Interval for checking the initialization timeout
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined); // Timeout for clearing error messages

  /**
   * Stable setter for the error message.
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
        setInternalWorkflowId(workflowIdFromUrl); // Use stable setter
        storeSetWorkflowId(workflowIdFromUrl);
        refetchRideState();
        if (justDismissedFlagRef.current) {
          justDismissedFlagRef.current = false;
          previousWorkflowIdOnDismissRef.current = null;
          if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
          logTs(`[WL&L workflowIdFromUrl] Cleared dismissal flags.`);
        }
      }
    } else { // No workflowId in URL
      if (internalWorkflowId && !justDismissedFlagRef.current && !isStartMutationPending) {
        logTs(`[WL&L workflowIdFromUrl] URL cleared, internalWorkflowId (${internalWorkflowId}) was set. Conditions met for reset (not pending start). Resetting internal state.`);
        storeReset();
        setInternalWorkflowId(null); // Use stable setter
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
      setInternalWorkflowId(storeWorkflowId); // Use stable setter
    } else if (!storeWorkflowId && internalWorkflowId && !isStartMutationPending) {
      logTs(`[WL&L storeWorkflowId] storeWorkflowId cleared, but internalWorkflowId (${internalWorkflowId}) was set and not pending start. Resetting.`);
      storeReset();
      setInternalWorkflowId(null); // Use stable setter
    }
    logTs(`[WL&L storeWorkflowId] END.`);
  }, [storeWorkflowId, internalWorkflowId, storeReset, setInternalWorkflowId, isStartMutationPending]);

  /**
   * Shows a temporary error message.
   */
  const showTemporaryError = useCallback((message: string) => {
    logTs(`[WL&L showTemporaryError] Called. Current errorMessage: "${errorMessage}". New message: "${message}"`);
    setErrorMessageState(message);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    const isInitializing = rideStateData?.status?.phase === 'INITIALIZING';
    if (!isInitializing) {
      errorTimeoutRef.current = setTimeout(() => {
        setErrorMessageState(null);
      }, 5000);
    }
  }, [rideStateData?.status?.phase, errorMessage]); // Keep errorMessage in deps for logging current value

  // Effect to reset ride-specific timers and flags when internalWorkflowId changes
  useEffect(() => {
    logTs(`[WL&L internalWorkflowId change] START. internalWorkflowId: ${internalWorkflowId}. Resetting ride timers/flags.`);
    setRideStartTime(null);
    setInitializingStartTime(null);
    setIsRequestTimedOut(false);
    setErrorMessageState(null);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = undefined;
    }
    if (!internalWorkflowId) {
      setIsRideActiveState(false);
      setShowSummary(false);
    }
    logTs(`[WL&L internalWorkflowId change] END. rideStartTime: null, initializingStartTime: null, isRequestTimedOut: false, errorMessage: null.`);
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
      logTs(`[WL&L rideStateData] Processing rideStateData. ServerPhase: ${serverPhase}`);

      const isActiveFromServer = isActivePhase(serverPhase);
      const isInitializing = serverPhase === 'INITIALIZING';
      const isFailed = serverPhase === 'FAILED';
      const isEnded = serverPhase === 'ENDED';

      if (isInitializing && !initializingStartTime) {
        setInitializingStartTime(Date.now());
      } else if (!isInitializing && initializingStartTime) {
        setInitializingStartTime(null);
        if (!isFailed && isRequestTimedOut) {
          setIsRequestTimedOut(false);
        }
      }
      
      if (isRideActiveState !== isActiveFromServer) setIsRideActiveState(isActiveFromServer);

      if (serverPhase === 'BLOCKED') {
        storeSetMovementDisabledMessage('Approve ride signal required to continue');
      } else {
        storeSetMovementDisabledMessage(rideStateData.status.lastError || null);
      }

      const canAnimate = isActiveFromServer && !isInitializing && serverPhase !== 'BLOCKED';
      storeSetIsAnimating(canAnimate);

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
        if (showSummary) setShowSummary(false);
        if (isRequestTimedOut) setIsRequestTimedOut(false);
        let finalElapsedSeconds = 0;
        if (rideStateData.status.startedAt && rideStateData.status.endedAt) {
             finalElapsedSeconds = calculateElapsedSeconds(rideStateData.status.startedAt, rideStateData.status.endedAt);
        } else if (rideStateData.status.startedAt) {
            finalElapsedSeconds = calculateElapsedSeconds(rideStateData.status.startedAt, undefined); // Current time if only startedAt
        }
        storeSetElapsed(fmtTime(finalElapsedSeconds));
      } else {
        if (showSummary) setShowSummary(false);
      }

      storeSetTokens(rideStateData.status.tokens?.total || 0);

      if (!isInitializing && errorMessage && errorMessage.includes('Ride initialization is taking too long')) {
        setErrorMessageState(null);
      }
    } else {
      logTs(`[WL&L rideStateData] No rideStateData or no rideStateData.status. internalWorkflowId: ${internalWorkflowId}`);
    }
    logTs(`[WL&L rideStateData] END. showSummary: ${showSummary}, isRideActiveState: ${isRideActiveState}`);
  }, [
    internalWorkflowId, rideStateData,
    storeSetTokens, storeSetElapsed, storeSetMovementDisabledMessage, storeSetIsAnimating,
    rideStartTime, initializingStartTime, isRequestTimedOut, errorMessage, showSummary, isRideActiveState,
    setRideStartTime, setIsRideActiveState, setShowSummary, setInitializingStartTime, setIsRequestTimedOut, setErrorMessageState, // Ensure all setters are stable or included
  ]);

  // Dedicated effect for INITIALIZING timeout check
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined = undefined;
    const currentPhaseIsInitializing = rideStateData?.status?.phase === 'INITIALIZING';

    if (currentPhaseIsInitializing && initializingStartTime && !isRequestTimedOut) {
      intervalId = setInterval(() => {
        if (!isRequestTimedOut) {
            const elapsedTime = Date.now() - initializingStartTime;
            if (elapsedTime > INITIALIZING_TIMEOUT_MS) {
              showTemporaryError('Ride initialization is taking a while.. please wait a moment.');
              setIsRequestTimedOut(true);
              if (intervalId) clearInterval(intervalId);
            }
        } else {
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

    setInternalWorkflowId(null); // Use stable setter
    storeSetWorkflowId(null);
    storeReset();
    resetInputFields(); // Call the passed-in reset function
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
    };
  }, []);

  return {
    // State
    internalWorkflowId,
    isRideActiveState,
    rideStartTime,
    showSummary,
    errorMessage, // The state value
    isRequestTimedOut,
    // Setters / Actions
    setInternalWorkflowId, // Exposed for direct setting, e.g., on start ride success
    setIsRideActiveState,
    setRideStartTime,
    setShowSummary,
    setErrorMessage, // The stable setter
    setIsRequestTimedOut,
    showTemporaryError,
    dismissSummaryAndReset,
  };
};
