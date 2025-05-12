// Purpose: Displays the ride summary after a ride ends.
import React from 'react';
import { Stat, BreakdownStat } from './StatComponents'; // Adjust path as needed
import type { RideStateResponse } from '../../api/rideApi'; // Adjust path as needed

interface RideSummaryDisplayProps {
  showSummary: boolean;
  isRideActive: boolean;
  rideStateData: RideStateResponse | null | undefined;
  distance: number;
  elapsedTime: string; // Formatted time string
  onDismissSummary: () => void;
}

export const RideSummaryDisplay: React.FC<RideSummaryDisplayProps> = ({
  showSummary,
  isRideActive,
  rideStateData,
  distance,
  elapsedTime,
  onDismissSummary,
}) => {
  if (!showSummary || isRideActive) { // Only show if summary is active and ride is not
    return null;
  }

  const isTimedOut = rideStateData?.status?.phase === 'TIMED_OUT';
  const containerClasses = isTimedOut
    ? 'border border-orange-300 bg-orange-50 rounded-lg p-4 mb-4 text-orange-800 flex flex-col items-center shadow-md animate-fade-in'
    : 'border border-green-300 bg-green-50 rounded-lg p-4 mb-4 text-green-800 flex flex-col items-center shadow-md animate-fade-in';
  const headingClasses = isTimedOut ? 'text-orange-700' : 'text-green-700';
  const headingText = isTimedOut ? 'Ride Timed Out' : 'Ride Summary';

  return (
    <div className={containerClasses}>
      <h3 className={`text-lg font-bold ${headingClasses} mb-3 text-center`}>{headingText}</h3>
      {!rideStateData ? (
        <div className="text-center">
          <p>Loading ride summary...</p>
        </div>
      ) : (
        <div className="w-full space-y-2">
          <Stat label="Distance (ft)" value={Math.round(distance).toString()} />
          <Stat label="Time" value={elapsedTime} />
          {typeof rideStateData.rideTimeoutSecs === 'number' && (
            <Stat label="Time Limit" value={`${rideStateData.rideTimeoutSecs}s`} />
          )}
          <Stat
            label="Cost"
            value={rideStateData?.status?.tokens?.total && rideStateData?.pricePerThousand && rideStateData?.currency
              ? `${rideStateData.currency} ${((rideStateData.status.tokens.total * rideStateData.pricePerThousand) / 1000).toFixed(2)}`
              : 'Loading...'}
          />
          <div className={`mt-4 rounded-md p-3 border ${isTimedOut ? 'bg-orange-100 border-orange-200' : 'bg-green-100 border-green-200'}`}>
            <h4 className={`text-sm font-semibold mb-2 text-center ${isTimedOut ? 'text-orange-700' : 'text-green-700'}`}>Token Breakdown</h4>
            <div className="space-y-1">
              <BreakdownStat
                label="Unlock fee"
                value={rideStateData?.status?.tokens?.unlock?.toString() ?? "0"}
              />
              <BreakdownStat
                label="Ride time"
                value={rideStateData?.status?.tokens?.time?.toString() ?? "0"}
              />
              <BreakdownStat
                label="Distance"
                value={rideStateData?.status?.tokens?.distance?.toString() ?? "0"}
              />
              <div className={`border-t my-2 ${isTimedOut ? 'border-orange-200' : 'border-green-200'}`}></div>
              <BreakdownStat
                label="Total"
                value={rideStateData?.status?.tokens?.total?.toString() ?? "0"}
                bold
              />
              {rideStateData?.status?.tokens?.total &&
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
        </div>
      )}
      <button
        onClick={onDismissSummary}
        className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium shadow-none disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed">
        Dismiss Summary
      </button>
    </div>
  );
};