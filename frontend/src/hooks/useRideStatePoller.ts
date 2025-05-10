// Purpose: Custom hook for polling ride state.
import { useQuery } from '@tanstack/react-query';
import { getRideState } from '../api/rideApi'; // Adjust path as needed
import type { RideStateResponse } from '../api/rideApi'; // Adjust path as needed

export const useRideStatePoller = (workflowId: string | null, enabled: boolean) => {
  return useQuery<RideStateResponse, Error>({ // Explicitly type Error for the query
    queryKey: ['rideState', workflowId],
    queryFn: async () => {
      if (!workflowId) throw new Error('No active workflow for getRideState');
      const response = await getRideState(workflowId);
      if (!response) {
        throw new Error('Unable to get ride status. Please try again.');
      }
      return response;
    },
    enabled: !!workflowId && enabled,
    refetchInterval: 200,
  });
};