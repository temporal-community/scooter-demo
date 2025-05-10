// Purpose: Custom hook for ride-related mutations (start, end, addDistance).
import { useMutation } from '@tanstack/react-query';
import { startRide, endRide, addDistance as addDistanceApi } from '../api/rideApi'; // Adjust path as needed

interface UseRideMutationsProps {
  workflowId: string | null;
  onStartSuccess?: (data: any) => void;
  onStartError?: (error: Error) => void;
  onEndMutate?: () => void;
  onEndSuccess?: (data: any) => void;
  onEndError?: (error: Error) => void;
  onAddDistanceError?: (error: Error) => void;
  validateEmailFn: (email: string) => { isValid: boolean; error?: string };
  validateScooterIdFn: (scooterId: string) => { isValid: boolean; error?: string };
}

export const useRideMutations = ({
  workflowId,
  onStartSuccess,
  onStartError,
  onEndMutate,
  onEndSuccess,
  onEndError,
  onAddDistanceError,
  validateEmailFn,
  validateScooterIdFn,
}: UseRideMutationsProps) => {
  const startMutation = useMutation({
    mutationFn: async (params: { email: string; scooterId: string }) => {
      const emailValidation = validateEmailFn(params.email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.error || 'Invalid email format');
      }
      const scooterIdValidation = validateScooterIdFn(params.scooterId);
      if (!scooterIdValidation.isValid) {
        throw new Error(scooterIdValidation.error || 'Invalid scooter ID');
      }
      console.log('Starting ride for email:', params.email, 'scooter:', params.scooterId);
      return startRide(params.scooterId, params.email);
    },
    onSuccess: onStartSuccess,
    onError: onStartError,
  });

  const endMutation = useMutation({
    mutationFn: () => {
      if (!workflowId) throw new Error('No active workflow to end ride');
      return endRide(workflowId);
    },
    onMutate: onEndMutate,
    onSuccess: onEndSuccess,
    onError: onEndError,
  });

  const addDistanceMutation = useMutation({
    mutationFn: () => {
      if (!workflowId) throw new Error('No active workflow for addDistance');
      console.log('Calling addDistanceApi via mutation for workflow:', workflowId);
      return addDistanceApi(workflowId);
    },
    onError: onAddDistanceError,
  });

  return { startMutation, endMutation, addDistanceMutation };
};