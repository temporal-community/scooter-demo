// Purpose: Component for scooter ID and email input, and unlock button.
import React from 'react';

interface RideFormProps {
  email: string;
  setEmail: (email: string) => void;
  emailError: string;
  setEmailError: (error: string) => void;
  scooterId: string;
  setScooterId: (id: string) => void;
  scooterIdError: string;
  setScooterIdError: (error: string) => void;
  onStartRide: () => void;
  isRideActive: boolean;
  isStarting: boolean;
  showSummary: boolean; // Added to control visibility based on summary
  validateEmail: (email: string) => { isValid: boolean; error?: string };
  validateScooterId: (scooterId: string) => { isValid: boolean; error?: string };
}

export const RideForm: React.FC<RideFormProps> = ({
  email,
  setEmail,
  emailError,
  setEmailError,
  scooterId,
  setScooterId,
  scooterIdError,
  setScooterIdError,
  onStartRide,
  isRideActive,
  isStarting,
  showSummary,
  validateEmail,
  validateScooterId
}) => {
  // Hide form if ride is active, starting, or summary is shown
  if (isRideActive || isStarting || showSummary) {
    return null;
  }

  const handleScooterIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const validation = validateScooterId(scooterId);
      if (validation.isValid) {
        // Check email too before starting, or rely on button click to validate both
         const emailValidation = validateEmail(email);
         if (emailValidation.isValid) {
            onStartRide();
         } else {
            setEmailError(emailValidation.error || "Invalid email.");
         }
      } else {
        setScooterIdError(validation.error || "Invalid scooter ID.");
      }
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const validation = validateEmail(email);
      if (validation.isValid) {
         const scooterValidation = validateScooterId(scooterId);
         if (scooterValidation.isValid) {
            onStartRide();
         } else {
            setScooterIdError(scooterValidation.error || "Invalid scooter ID.");
         }
      } else {
        setEmailError(validation.error || "Invalid email.");
      }
    }
  };


  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <label htmlFor="scooterId" className="text-sm text-gray-600 whitespace-nowrap">Scooter ID:</label>
          <input
            id="scooterId"
            type="text"
            placeholder="e.g. 5555"
            className={`input input-bordered w-full p-3 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 ${
              scooterIdError ? 'border-red-500' : ''
            }`}
            value={scooterId}
            onChange={(e) => {
              setScooterId(e.target.value);
              setScooterIdError(''); 
            }}
            onKeyDown={handleScooterIdKeyDown}
            disabled={isRideActive || isStarting}
          />
        </div>
        {scooterIdError && (
          <p className="text-red-500 text-sm mt-1">{scooterIdError}</p>
        )}
      </div>

      <div className="space-y-1">
        <input
          type="email"
          placeholder="maria@example.com"
          className={`input input-bordered w-full p-3 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 ${
            emailError ? 'border-red-500' : ''
          }`}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError('');
          }}
          onKeyDown={handleEmailKeyDown}
          disabled={isRideActive || isStarting}
        />
        {emailError && (
          <p className="text-red-500 text-sm mt-1">{emailError}</p>
        )}
      </div>

      <button
        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-md shadow-md transition-all duration-200 hover:shadow-lg disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
        onClick={onStartRide}
        disabled={isRideActive || isStarting}
      >
        Unlock Scooter
      </button>
    </>
  );
};