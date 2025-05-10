import { useState, useCallback } from 'react';
import { validateEmail as validateEmailUtil, validateScooterId as validateScooterIdUtil } from '../utils/validationUtils';
import { logTs } from './rideOrchestrator.utils';

/**
 * Custom hook to manage email and scooter ID inputs and their validation.
 */
export const useRideInputs = () => {
  // State for email input and validation
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // State for scooter ID input and validation, with a random initial value
  const generateNoNineId = () => {
    let id = '';
    for (let i = 0; i < 4; i++) {
      // Digits 0-8 only
      const digit = Math.floor(Math.random() * 9); // 0-8
      // First digit should not be 0
      if (i === 0 && digit === 0) {
        id += '1';
      } else {
        id += digit.toString();
      }
    }
    return id;
  };
  const [scooterId, setScooterId] = useState(() => {
    const randomId = generateNoNineId();
    logTs(`[useRideInputs] Initial random scooterId: ${randomId}`);
    return randomId;
  });
  const [scooterIdError, setScooterIdError] = useState('');

  /**
   * Resets all input fields and their associated errors.
   */
  const resetInputs = useCallback(() => {
    setEmail('');
    setEmailError('');
    const newRandomId = generateNoNineId();
    setScooterId(newRandomId);
    logTs(`[useRideInputs] Inputs reset. New scooterId: ${newRandomId}`);
    setScooterIdError('');
  }, []);

  return {
    email, setEmail,
    emailError, setEmailError,
    scooterId, setScooterId,
    scooterIdError, setScooterIdError,
    validateEmailUtil, // Exposing these for use in handleStartRide
    validateScooterIdUtil,
    resetInputs,
  };
};