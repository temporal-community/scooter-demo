// frontend/src/components/Hud/Hud.tsx
import { useRideOrchestrator } from '../../hooks/useRideOrchestrator'; // Adjust path
import { RideForm } from './RideForm';
import { RideSummaryDisplay } from './RideSummaryDisplay';
import { LiveStatsDisplay } from './LiveStatsDisplay';
import { ErrorMessageDisplay } from './ErrorMessage';
import { WorkflowFailureDisplay } from './WorkflowFailureDisplay';
import type { NavigateFunction } from 'react-router-dom';

// Using the more complete props definition from your "older" file
interface HudProps {
  workflowIdFromUrl?: string;
  navigate?: NavigateFunction;
}

export default function Hud({ workflowIdFromUrl, navigate }: HudProps) {
  const {
    email,
    setEmail,
    emailError,
    setEmailError,
    scooterId,
    setScooterId,
    scooterIdError,
    setScooterIdError,
    isRideActive, // This is the crucial client-side state
    rideStateData,
    isLoadingRideState,
    showSummary,
    errorMessage,
    rideStatusMessage,
    storeDistance,
    storeElapsed,
    internalWorkflowId, // Needed for the workflow ID display
    startMutation,      // Needed for RideForm and WorkflowFailureDisplay
    endMutation,        // Needed for the End Ride button
    handleStartRide,
    handleEndRide,
    dismissSummaryAndReset, // Needed for RideSummaryDisplay
    validateEmailUtil,      // Needed for RideForm and WorkflowFailureDisplay
    validateScooterIdUtil,  // Needed for RideForm
    isStarting,            // Added for RideForm
  } = useRideOrchestrator(workflowIdFromUrl, navigate);

  return (
    <div className="space-y-4 p-4 max-w-md mx-auto font-sans">
      {/* Display Workflow ID (from older version) */}
      {internalWorkflowId && (
        <p className={`text-center text-xs font-mono break-all ${
          internalWorkflowId.includes('9') // Example conditional styling
            ? 'text-red-700'
            : internalWorkflowId.endsWith('1234')
              ? 'text-yellow-700'
              : 'text-gray-500'
        }`}>
          Workflow: {internalWorkflowId}
        </p>
      )}

      {/* Error Message Display (from older version) */}
      <ErrorMessageDisplay message={errorMessage} />

      {/* Ride Summary Display (props from older version, including onDismissSummary) */}
      <RideSummaryDisplay
        showSummary={showSummary}
        isRideActive={isRideActive}
        rideStateData={rideStateData}
        distance={storeDistance}
        elapsedTime={storeElapsed}
        onDismissSummary={dismissSummaryAndReset}
      />

      {/* Ride Status Message (from older version) */}
      <div className="space-y-2">
        <p className="text-center text-sm text-gray-600 min-h-[20px]">{rideStatusMessage}</p>
      </div>
      
      {/* RideForm (from older version) */}
      <RideForm
        email={email}
        setEmail={setEmail}
        emailError={emailError}
        setEmailError={setEmailError}
        scooterId={scooterId}
        setScooterId={setScooterId}
        scooterIdError={scooterIdError}
        setScooterIdError={setScooterIdError}
        onStartRide={handleStartRide}
        isRideActive={isRideActive}
        isStarting={isStarting}
        showSummary={showSummary}
        validateEmail={validateEmailUtil}
        validateScooterId={validateScooterIdUtil}
      />

      {/* End Ride Button (from older version) */}
      {isRideActive && rideStateData?.status?.phase !== 'FAILED' && (
        <button
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-md shadow-md transition-all duration-200 hover:shadow-lg disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          onClick={handleEndRide}
          disabled={!isRideActive || endMutation.isPending}
        >
          End Ride
        </button>
      )}
      
      {/* LiveStatsDisplay (with the crucial isRideActiveClient prop) */}
      <LiveStatsDisplay
        rideStateData={rideStateData}
        distance={storeDistance}
        elapsedTime={storeElapsed}
        isLoading={isLoadingRideState}
        isRideActiveClient={isRideActive}
      />
      
      {/* WorkflowFailureDisplay (from older version) */}
      <WorkflowFailureDisplay
        rideStateData={rideStateData}
        email={email}
        setEmail={setEmail}
        emailError={emailError}
        setEmailError={setEmailError}
        onRetry={handleStartRide} // Retry uses the same start ride logic
        isRetrying={startMutation.isPending}
        validateEmail={validateEmailUtil}
      />
    </div>
  );
}
