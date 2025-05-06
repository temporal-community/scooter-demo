import { create } from 'zustand';

interface RideState {
  distance: number;
  elapsed: string; // "hh:mm"
  tokens: number;
  isAnimating: boolean; // Added for animation control
  workflowId: string | null; // Added for Temporal workflow tracking
  setDistance: (km: number) => void;
  setElapsed: (time: string) => void;
  setTokens: (tokens: number) => void;
  setIsAnimating: (isAnimating: boolean) => void; // Added for animation control
  setWorkflowId: (workflowId: string | null) => void; // Added for setting workflow ID
  reset: () => void;
}

export const useRideStore = create<RideState>(set => ({
  distance: 0,
  elapsed: '00:00',
  tokens: 0,
  isAnimating: false, // Default to not animating
  workflowId: null, // Initialize as null
  setDistance: km => set({ distance: km }),
  setElapsed: time => set({ elapsed: time }),
  setTokens: tokens => set({ tokens }),
  setIsAnimating: isAnimating => set({ isAnimating }), // Setter for animation state
  setWorkflowId: workflowId => set({ workflowId }), // Added setter for workflow ID
  reset: () => set({ 
    distance: 0, 
    elapsed: '00:00', 
    tokens: 0, 
    isAnimating: false,
    workflowId: null // Reset workflow ID too
  }), // Reset animation state too
}));
