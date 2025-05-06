import { create } from 'zustand';

interface RideState {
  distance: number;
  elapsed: string; // "hh:mm"
  tokens: number;
  setDistance: (km: number) => void;
  setElapsed: (time: string) => void;
  setTokens: (tokens: number) => void;
  reset: () => void;
}

export const useRideStore = create<RideState>(set => ({
  distance: 0,
  elapsed: '00:00',
  tokens: 0,
  setDistance: km => set({ distance: km }),
  setElapsed: time => set({ elapsed: time }),
  setTokens: tokens => set({ tokens }),
  reset: () => set({ distance: 0, elapsed: '00:00', tokens: 0 }),
}));
