// Purpose: Displays live statistics during an active ride.
import React from 'react';
import { Stat, BreakdownStat } from './StatComponents'; // Adjust path as needed
import type { RideStateResponse } from '../../api/rideApi'; // Adjust path as needed

interface LiveStatsDisplayProps {
  // isRideActive: boolean; // REMOVED - This was redundant as logic relies on rideStateData.status.phase
  rideStateData: RideStateResponse | null | undefined;
  distance: number;
  elapsedTime: string; // Formatted time string
  isLoading: boolean;
}

const ACTIVE_PHASES_FOR_LIVE_STATS = ['INITIALIZING', 'ACTIVE', 'BLOCKED'];

export const LiveStatsDisplay: React.FC<LiveStatsDisplayProps> = ({
  rideStateData,
  distance,
  elapsedTime,
  isLoading,
}) => {
  // Show if ride phase is one of the active ones
  const showStats = ACTIVE_PHASES_FOR_LIVE_STATS.includes(rideStateData?.status?.phase ?? '');

  if (!showStats) {
    return null;
  }
  
  return (
    <div className="mt-6 space-y-1 p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-semibold text-gray-700 mb-2 text-center">Live Ride Stats</h3>
      <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
      <Stat label="Time" value={elapsedTime} />
      <Stat 
        label="Cost" 
        value={rideStateData && typeof rideStateData.pricePerThousand === 'number' && rideStateData.currency
          ? `${rideStateData.currency} ${((rideStateData.status.tokens.total * rideStateData.pricePerThousand) / 1000).toFixed(2)}` 
          : 'Loading...'} 
      />
      <div className="mt-4 bg-gray-50 border border-gray-100 rounded-md p-3">
        <h4 className="text-sm font-semibold text-gray-600 mb-2 text-center">Token Breakdown</h4>
        <div className="space-y-1">
          <BreakdownStat label="Unlock fee" value={rideStateData?.status.tokens.unlock?.toString() ?? "0"} />
          <BreakdownStat label="Ride time" value={rideStateData?.status.tokens.time?.toString() ?? "0"} />
          <BreakdownStat label="Distance" value={rideStateData?.status.tokens.distance?.toString() ?? "0"} />
          <div className="border-t border-gray-200 my-2"></div>
          <BreakdownStat label="Total" value={rideStateData?.status.tokens.total?.toString() ?? "0"} bold />
          {rideStateData &&
            typeof rideStateData.pricePerThousand === 'number' &&
            typeof rideStateData.currency === 'string' && (
              <div className="mt-2 text-xs text-gray-500 text-center">
                {`${rideStateData.status.tokens.total} tokens × $${(rideStateData.pricePerThousand / 1000).toFixed(3)} = $${((rideStateData.status.tokens.total * rideStateData.pricePerThousand) / 1000).toFixed(2)}`}
                <br />
                {`1,000 tokens = $${rideStateData.pricePerThousand.toFixed(2)} (${rideStateData.currency})`}
              </div>
            )}
        </div>
      </div>
      {isLoading && <p className="text-xs text-gray-400 text-center mt-2">Updating stats...</p>}
    </div>
  );
};