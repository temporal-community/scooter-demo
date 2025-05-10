// Purpose: Utility functions for input validation.

export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
    if (!email.trim()) {
      return { isValid: false, error: 'Please enter an email address' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }
    return { isValid: true };
  };
  
  export const validateScooterId = (id: string): { isValid: boolean; error?: string } => {
    if (!id.trim()) {
      return { isValid: false, error: 'Please enter a scooter ID' };
    }
    // Add any other specific scooter ID validation rules here if necessary
    return { isValid: true };
  };