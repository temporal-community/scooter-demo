// Purpose: Displays UI for ride failures, e.g., account not found.
import React from 'react';

interface WorkflowFailureDisplayProps {
  rideStateData: {
    status: {
      phase: string;
      lastError?: string | null;
    };
  } | null | undefined;
  email: string;
  setEmail: (email: string) => void;
  emailError: string;
  setEmailError: (error: string) => void;
  onRetry: () => void;
  isRetrying: boolean; // Corresponds to start.isPending
  validateEmail: (email: string) => { isValid: boolean; error?: string };
}

export const WorkflowFailureDisplay: React.FC<WorkflowFailureDisplayProps> = ({
  rideStateData,
  email,
  setEmail,
  emailError,
  setEmailError,
  onRetry,
  isRetrying,
  validateEmail
}) => {
  if (rideStateData?.status?.phase !== 'FAILED') {
    return null;
  }
  
  console.log('Debug rideStateData for WorkflowFailureDisplay:', {
    phase: rideStateData?.status?.phase,
    lastError: rideStateData?.status?.lastError
  });

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isRetrying) {
        const validation = validateEmail(email);
        if (validation.isValid) {
            onRetry();
        } else {
            setEmailError(validation.error || "Invalid email.");
        }
    }
  };

  return (
    <div className="mt-6 border border-red-300 bg-red-50 rounded-lg p-4 mb-4 text-red-800 flex flex-col items-center shadow-md animate-fade-in">
      <div className="flex items-center mb-3">
        <svg className="w-7 h-7 text-red-500 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="font-bold text-xl">Unable to Start Ride</span>
      </div>
      <div className="w-full space-y-4">
        <p className="text-center text-red-700">
          {rideStateData.status.lastError === 'ACCOUNT_NOT_FOUND'
            ? 'We couldn\'t find an account with that email address.'
            : rideStateData.status.lastError // Display specific error from API if available
            ? `There was a problem starting your ride: ${rideStateData.status.lastError.replace(/_/g, ' ').toLowerCase()}`
            : 'There was a problem starting your ride. Please check the details and try again.'}
        </p>
        
        <div className="space-y-1">
          <input
            type="email"
            placeholder="Try another email address"
            className="input input-bordered w-full p-3 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-800"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError('');
            }}
            onKeyDown={handleEmailKeyDown}
            disabled={isRetrying}
          />
          {emailError && (
            <p className="text-red-500 text-sm mt-1">{emailError}</p>
          )}
        </div>

        <button
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-md shadow-md transition-all duration-200 hover:shadow-lg disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          onClick={() => {
            const validation = validateEmail(email);
            if (validation.isValid) {
                onRetry();
            } else {
                setEmailError(validation.error || "Invalid email.");
            }
          }}
          disabled={isRetrying}
        >
          Try Again
        </button>
      </div>
    </div>
  );
};