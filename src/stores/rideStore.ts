import { create } from 'zustand';

interface RideState {
  distance: number;
  elapsed: string; // "hh:mm"
  tokens: number;
  isAnimating: boolean; // Added for animation control
  setDistance: (km: number) => void;
  setElapsed: (time: string) => void;
  setTokens: (tokens: number) => void;
  setIsAnimating: (isAnimating: boolean) => void; // Added for animation control
  reset: () => void;
}

export const useRideStore = create<RideState>(set => ({
  distance: 0,
  elapsed: '00:00',
  tokens: 0,
  isAnimating: false, // Default to not animating
  setDistance: km => set({ distance: km }),
  setElapsed: time => set({ elapsed: time }),
  setTokens: tokens => set({ tokens }),
  setIsAnimating: isAnimating => set({ isAnimating }), // Setter for animation state
  reset: () => set({ distance: 0, elapsed: '00:00', tokens: 0, isAnimating: false }), // Reset animation state too
}));
