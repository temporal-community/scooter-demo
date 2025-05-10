// Purpose: Main hook to orchestrate ride logic, state, and effects.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRideStore } from '../stores/rideStore'; // Adjust path
import { useRideTimer } from './useRideTimer';
import { useRideMutations } from './useRideMutations';
import { useRideStatePoller } from './useRideStatePoller';
import { fmtTime } from '../utils/timeUtils'; // Adjust path
import { validateEmail as validateEmailUtil, validateScooterId as validateScooterIdUtil } from '../utils/validationUtils'; // Adjust path

const ACTIVE_PHASES = ['INITIALIZING', 'ACTIVE', 'BLOCKED'];

export const useRideOrchestrator = () => {
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
  
  const [internalWorkflowId, setInternalWorkflowId] = useState<string | null>(storeWorkflowId);
  const [isRideActiveState, setIsRideActiveState] = useState(false); // Local component version of isRideActive
  const [showSummary, setShowSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false);

  const lastBucketRef = useRef(0);
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const requestTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const initializingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const endingRef = useRef(false); // Used for optimistic UI updates on end ride

  const localElapsedSeconds = useRideTimer(isRideActiveState);

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
      // localElapsedSeconds is reset by useRideTimer when isRideActiveState becomes false then true
      lastBucketRef.current = 0;
      setIsRideActiveState(true); // This will trigger the timer
      storeSetIsAnimating(true); // Default to true, will be adjusted by poller
      storeSetMovementDisabledMessage(null);
      setShowSummary(false);
      setInternalWorkflowId(dataResponse.workflowId);
      storeSetWorkflowId(dataResponse.workflowId); // Sync with Zustand
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
      setIsRideActiveState(false); // Stop timer, animation
      storeSetIsAnimating(false);
      setShowSummary(true); // Show summary optimistically
    },
    onEndSuccess: () => {
      endingRef.current = false;
      // Ride state poller will eventually update phase to ENDED
      // No need to call storeReset() here, summary needs data.
      // storeSetWorkflowId(null) will be handled by dismissSummary
    },
    onEndError: (error: Error) => {
      endingRef.current = false;
      setShowSummary(false); // Roll back optimistic summary
      setIsRideActiveState(true); // Resume timer, animation if ride wasn't actually ended
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showTemporaryError('Unable to connect to the server. Please check if the API is running.');
      } else {
        showTemporaryError(error.message || 'Failed to end ride');
      }
      // Do not immediately setIsAnimating(false) here, let poller decide
      // storeSetMovementDisabledMessage('Unable to end ride. Please try again.'); // This might be too aggressive
    },
    onAddDistanceError: (error: Error) => {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showTemporaryError('Unable to connect to the server. Please check if the API is running.');
      }
      // Potentially log other errors or handle them silently
    },
  });

  const rideStateQuery = useRideStatePoller(internalWorkflowId, !!internalWorkflowId); // Only enable poller if workflowId exists
  const { data: rideStateData, isLoading: isLoadingRideState, error: rideStateError } = rideStateQuery;

  // Effect for INITIALIZING timeout
  useEffect(() => {
    if (rideStateData?.status?.phase === 'INITIALIZING' && isRideActiveState) {
      if (initializingTimeoutRef.current) clearTimeout(initializingTimeoutRef.current);
      initializingTimeoutRef.current = setTimeout(() => {
        if (!isRequestTimedOut) { // Only show if not already showing a broader request timeout
          setErrorMessage('Your ride is taking longer than usual to start. Don\'t worry, your ride is active and we\'re working on getting your stats ready. Please try again in a moment.');
        }
      }, 3000);
    } else {
      if (initializingTimeoutRef.current) clearTimeout(initializingTimeoutRef.current);
      if (rideStateData?.status?.phase !== 'INITIALIZING' && !isRequestTimedOut && errorMessage === 'Your ride is taking longer than usual to start. Don\'t worry, your ride is active and we\'re working on getting your stats ready. Please try again in a moment.') {
        setErrorMessage(null); // Clear only this specific message
      }
    }
    return () => { if (initializingTimeoutRef.current) clearTimeout(initializingTimeoutRef.current); };
  }, [rideStateData?.status?.phase, isRideActiveState, isRequestTimedOut, errorMessage]);

  // Effect for general request timeout while loading ride state
  useEffect(() => {
    if (isLoadingRideState && isRideActiveState && internalWorkflowId) { // Ensure workflowId exists
      if (requestTimeoutRef.current) clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = setTimeout(() => {
        setIsRequestTimedOut(true);
        setErrorMessage('Taking longer than usual to get your ride status. Your ride is still active, but we can\'t show your current stats. Please try again in a moment.');
      }, 3000);
    } else {
      if (requestTimeoutRef.current) clearTimeout(requestTimeoutRef.current);
      if (!isLoadingRideState) {
        setIsRequestTimedOut(false);
        // Clear the request timeout message if it was set
        if (errorMessage === 'Taking longer than usual to get your ride status. Your ride is still active, but we can\'t show your current stats. Please try again in a moment.' && rideStateData?.status?.phase !== 'INITIALIZING') {
            setErrorMessage(null);
        }
      }
    }
    return () => { if (requestTimeoutRef.current) clearTimeout(requestTimeoutRef.current); };
  }, [isLoadingRideState, isRideActiveState, internalWorkflowId, rideStateData?.status?.phase, errorMessage]);

  // Effect to handle ride state errors from poller
  useEffect(() => {
    if (rideStateError) {
      const error = rideStateError as Error; // Type assertion
      if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        setErrorMessage('We\'re having trouble connecting to our servers. Your ride is still active, but we can\'t show your current stats. Please try again in a moment.');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setErrorMessage('Unable to connect to our servers. Your ride is still active, but we can\'t show your current stats. Please check your internet connection.');
      } else {
        setErrorMessage(error.message || 'Unable to get ride status. Please try again.');
      }
    } else {
      // Clear error message if no error, not request timed out, and not in initializing phase (which has its own message)
      if (!isRequestTimedOut && rideStateData?.status?.phase !== 'INITIALIZING' && !isLoadingRideState) {
         // More specific clearing based on current error message to avoid clearing initializing message
        if (errorMessage && (errorMessage.includes('Unable to get ride status') || errorMessage.includes('connecting to our servers') || errorMessage.includes('internet connection'))) {
            setErrorMessage(null);
        }
      }
    }
  }, [rideStateError, isRequestTimedOut, rideStateData?.status?.phase, isLoadingRideState, errorMessage]);


  // Effect to process data from getRideState API poll
  useEffect(() => {
    if (!rideStateData || !internalWorkflowId) return; // Ensure workflowId is present

    const { phase, tokens, lastError } = rideStateData.status;
    const currentRideIsActive = ACTIVE_PHASES.includes(phase);

    setIsRideActiveState(currentRideIsActive); // Update local active state

    if (phase === 'ENDED' && !showSummary && !endingRef.current) {
      setShowSummary(true);
    }
    if (currentRideIsActive && showSummary && !endingRef.current) {
      setShowSummary(false);
    }

    storeSetTokens(tokens.total);
    storeSetElapsed(fmtTime(localElapsedSeconds));

    const shouldAnimate = phase !== 'FAILED' && phase !== 'ENDED' && phase !== 'BLOCKED';
    storeSetIsAnimating(shouldAnimate);

    if (!shouldAnimate) {
      if (phase === 'BLOCKED') {
        storeSetMovementDisabledMessage('Approve ride signal required to continue');
      } else if (lastError === 'ACCOUNT_NOT_FOUND') {
        storeSetMovementDisabledMessage('Account not found. Please try a different email address.');
      } else if (phase === 'FAILED') {
        storeSetMovementDisabledMessage('Ride failed. Please try again.');
      } else if (phase === 'ENDED') {
        storeSetMovementDisabledMessage('Ride ended. Please start a new ride to continue.');
      } else {
         storeSetMovementDisabledMessage('Movement disabled.'); // Generic fallback
      }
    } else {
      storeSetMovementDisabledMessage(null);
    }
  }, [
    rideStateData, 
    localElapsedSeconds, 
    storeSetTokens, 
    storeSetElapsed, 
    storeSetIsAnimating, 
    storeSetMovementDisabledMessage, 
    showSummary,
    internalWorkflowId // Add internalWorkflowId dependency
  ]);

  // Effect to call addDistanceApi
  useEffect(() => {
    if (!isRideActiveState || storeDistance <= 0 || !internalWorkflowId) {
      if (storeDistance === 0) lastBucketRef.current = 0;
      return;
    }

    const currentBucket = Math.floor(storeDistance / 100);
    const previousBucket = lastBucketRef.current;

    if (currentBucket > previousBucket) {
      console.log(`Orchestrator: Store distance ${storeDistance}ft. Current bucket ${currentBucket}, previous bucket ${previousBucket}.`);
      for (let i = previousBucket + 1; i <= currentBucket; i++) {
        console.log(`Orchestrator: Mutating addDistance for bucket ${i}.`);
        addDistanceMutation.mutate();
      }
      lastBucketRef.current = currentBucket;
    }
  }, [storeDistance, isRideActiveState, addDistanceMutation, internalWorkflowId]);


  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (requestTimeoutRef.current) clearTimeout(requestTimeoutRef.current);
      if (initializingTimeoutRef.current) clearTimeout(initializingTimeoutRef.current);
    };
  }, []);

  const handleStartRide = () => {
    const emailValidation = validateEmailUtil(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error!);
      return;
    }
    setEmailError('');

    const scooterIdValidation = validateScooterIdUtil(scooterId);
    if (!scooterIdValidation.isValid) {
      setScooterIdError(scooterIdValidation.error!);
      return;
    }
    setScooterIdError('');
    startMutation.mutate({ email, scooterId });
  };

  const handleEndRide = () => {
    endMutation.mutate();
  };

  const dismissSummaryAndReset = () => {
    setShowSummary(false);
    setInternalWorkflowId(null);
    storeSetWorkflowId(null); // Clear from Zustand store
    storeReset(); // Clear distance, elapsed, tokens from store
    setIsRideActiveState(false); // Ensure timer stops and local state is reset
    // setEmail(''); // Optionally reset email/scooterId or keep them for user convenience
    // setScooterId(Math.floor(1000 + Math.random() * 9000).toString());
  };
  
  // Determine ride status message
  let rideStatusMessage = "Enter your email and unlock the scooter to start your ride.";
  if (startMutation.isPending) {
    rideStatusMessage = "Unlocking scooter...";
  } else if (endMutation.isPending) {
    rideStatusMessage = "Ending ride...";
  } else if (isRideActiveState) {
    rideStatusMessage = "Ride in progress. Use the right arrow key on your keyboard to move.";
  } else if (showSummary) {
    rideStatusMessage = "Ride ended.";
  } else if (internalWorkflowId && storeTokens > 0 && !isRideActiveState) {
    rideStatusMessage = "Previous ride ended. Unlock scooter to start a new ride.";
  }


  return {
    email,
    setEmail,
    emailError,
    setEmailError,
    scooterId,
    setScooterId,
    scooterIdError,
    setScooterIdError,
    isRideActive: isRideActiveState,
    rideStateData,
    isLoadingRideState,
    showSummary,
    errorMessage,
    rideStatusMessage,
    localElapsedSeconds, // For display if needed, though storeElapsed is primary
    storeDistance, // from Zustand
    storeElapsed,  // from Zustand
    storeTokens,   // from Zustand
    internalWorkflowId, // Expose for display
    startMutation, // Expose mutation objects for isPending etc.
    endMutation,
    handleStartRide,
    handleEndRide,
    dismissSummaryAndReset,
    validateEmailUtil, // Exposing for direct use in form if needed for onKeyDown
    validateScooterIdUtil
  };
};