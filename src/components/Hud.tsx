import { useRideStore } from '../stores/rideStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startRide, endRide, getRideState } from '../api/rideApi';
import { useEffect } from 'react';

/** Converts raw seconds → "hh:mm" */
const fmtTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface RideStateResponse {
  distanceKm: number;
  elapsedSeconds: number;
  tokens: number;
}

export default function Hud() {
  // global state + setters
  const {
    distance, elapsed, tokens,
    reset, setDistance, setElapsed, setTokens,
  } = useRideStore();

  /* --- mutations (stubbed for now) ------------------------ */

  const start = useMutation({
    mutationFn: startRide,
    onSuccess: () => reset()
  });
  const end = useMutation({
    mutationFn: endRide
  });

  /* --- poll mock / real API every second ------------------ */

  const { data } = useQuery<RideStateResponse>({
    queryKey: ['rideState'],
    queryFn: getRideState,
    refetchInterval: 1_000,
  });

  // Update store when data changes
  useEffect(() => {
    if (data) {
      setDistance(data.distanceKm);
      setElapsed(fmtTime(data.elapsedSeconds));
      setTokens(data.tokens);
    }
  }, [data, setDistance, setElapsed, setTokens]);

  /* --- UI -------------------------------------------------- */

  return (
    <div className="space-y-4">
      <button
        className="btn btn-primary w-full"
        onClick={() => start.mutate()}
        disabled={start.isPending}
      >
        New ride
      </button>

      <button
        className="btn btn-secondary w-full"
        onClick={() => end.mutate()}
        disabled={end.isPending}
      >
        End ride
      </button>

      <div className="mt-6 space-y-1">
        <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
        <Stat label="Time" value={elapsed} />
        <Stat label="Cost (tokens)" value={tokens.toFixed(1)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
