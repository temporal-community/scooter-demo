import { expect } from 'chai';
import { render, screen } from '@testing-library/react';
import { LiveStatsDisplay } from '../src/components/Hud/LiveStatsDisplay';
import type { RideStateResponse } from '../src/api/rideApi';

describe('LiveStatsDisplay', () => {
  const baseData: RideStateResponse = {
    scooterId: '1',
    emailAddress: 'x',
    customerId: 'c',
    meterName: 'm',
    rideTimeoutSecs: 60,
    pricePerThousand: 25,
    currency: 'USD',
    status: {
      phase: 'ACTIVE',
      startedAt: '',
      lastMeterAt: '',
      distanceFt: 10,
      tokens: { unlock: 1, time: 1, distance: 1, total: 3 }
    }
  };

  it('returns null when not active client-side', () => {
    const { container } = render(
      <LiveStatsDisplay rideStateData={undefined} distance={0} elapsedTime="" isLoading={false} isRideActiveClient={false} />
    );
    expect(container.firstChild).to.be.null;
  });

  it('shows initializing when data missing', () => {
    render(<LiveStatsDisplay rideStateData={undefined} distance={0} elapsedTime="" isLoading={false} isRideActiveClient />);
    expect(screen.getByText(/initializing ride data/i)).to.exist;
  });

  it('shows stats when data present', () => {
    render(<LiveStatsDisplay rideStateData={baseData} distance={5} elapsedTime="00:10" isLoading={false} isRideActiveClient />);
    expect(screen.getByText('Live Ride Stats')).to.exist;
    expect(screen.getByText('Distance (ft)')).to.exist;
    expect(screen.getByText('3')).to.exist; // total tokens
  });

  it('shows updating message when loading', () => {
    render(<LiveStatsDisplay rideStateData={baseData} distance={5} elapsedTime="00:10" isLoading isRideActiveClient />);
    expect(screen.getByText(/updating stats/i)).to.exist;
  });
});
