// frontend/src/components/Hud/LiveStatsDisplay.tsx
import React from 'react';
import { Stat, BreakdownStat } from './StatComponents'; // Adjust path as needed
import type { RideStateResponse } from '../../api/rideApi'; // Adjust path as needed

interface LiveStatsDisplayProps {
  rideStateData: RideStateResponse | null | undefined;
  distance: number;
  elapsedTime: string; // Formatted time string
  isLoading: boolean;
  isRideActiveClient: boolean; // ADD THIS PROP: The client's immediate idea of ride active status
}

export const LiveStatsDisplay: React.FC<LiveStatsDisplayProps> = ({
  rideStateData,
  distance,
  elapsedTime,
  isLoading,
  isRideActiveClient, // USE THIS PROP
}) => {
  // The primary condition for showing live stats is now the client-side active flag.
  // This ensures it hides immediately when "End Ride" is clicked.
  if (!isRideActiveClient) {
    return null;
  }

  // Fallback or loading state if ride is active client-side but data isn't fully populated yet
  // This can happen briefly when a ride starts or if there's a slight delay in the first poll.
  if (!rideStateData?.status) {
    return (
      <div className="mt-6 space-y-1 p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
        <h3 className="text-lg font-semibold text-gray-700 mb-2 text-center">Live Ride Stats</h3>
        <p className="text-center text-gray-500">Initializing ride data...</p>
      </div>
    );
  }
  
  // If ride is active client-side, but server phase is unexpectedly not an active one,
  // you might choose to hide or show a specific message.
  // However, isRideActiveClient should generally align with server phase for active rides.
  // const serverPhaseIsActive = ['INITIALIZING', 'ACTIVE', 'BLOCKED'].includes(rideStateData.status.phase);
  // if (!serverPhaseIsActive) {
  //   // This case should ideally not happen if isRideActiveClient is true,
  //   // but can be a fallback.
  //   return null; 
  // }

  return (
    <div className="mt-6 space-y-1 p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-semibold text-gray-700 mb-2 text-center">Live Ride Stats</h3>
      <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
      <Stat label="Time" value={elapsedTime} />
      {typeof rideStateData.rideTimeoutSecs === 'number' && (
        <Stat label="Time Limit" value={`${rideStateData.rideTimeoutSecs}s`} />
      )}
      <Stat
        label="Cost"
        value={rideStateData.status && typeof rideStateData.pricePerThousand === 'number' && rideStateData.currency
          ? `${rideStateData.currency} ${((rideStateData.status.tokens.total * rideStateData.pricePerThousand) / 1000).toFixed(2)}` 
          : 'N/A'} // Changed from 'Loading...' to 'N/A' if data isn't ready
      />
      {/* Ensure rideStateData.status.tokens exists before trying to render the breakdown */}
      {rideStateData.status.tokens && (
        <div className="mt-4 bg-gray-50 border border-gray-100 rounded-md p-3">
          <h4 className="text-sm font-semibold text-gray-600 mb-2 text-center">Token Breakdown</h4>
          <div className="space-y-1">
            <BreakdownStat label="Unlock fee" value={rideStateData.status.tokens.unlock?.toString() ?? "0"} />
            <BreakdownStat label="Ride time" value={rideStateData.status.tokens.time?.toString() ?? "0"} />
            <BreakdownStat label="Distance" value={rideStateData.status.tokens.distance?.toString() ?? "0"} />
            <div className="border-t border-gray-200 my-2"></div>
            <BreakdownStat label="Total" value={rideStateData.status.tokens.total?.toString() ?? "0"} bold />
            {rideStateData && // rideStateData itself should be checked here too
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
      )}
      {/* Show "Updating stats..." only if loading AND the ride is considered active client-side */}
      {isLoading && isRideActiveClient && <p className="text-xs text-gray-400 text-center mt-2">Updating stats...</p>}
    </div>
  );
};
