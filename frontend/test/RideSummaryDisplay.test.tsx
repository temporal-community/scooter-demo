import { expect } from 'chai';
import { fireEvent, render, screen } from '@testing-library/react';
import { RideSummaryDisplay } from '../src/components/Hud/RideSummaryDisplay.tsx';
import type { RideStateResponse } from '../src/api/rideApi.ts';

describe('RideSummaryDisplay', () => {
  const baseData: RideStateResponse = {
    scooterId: '1',
    emailAddress: 'x',
    customerId: 'c',
    meterName: 'm',
    rideTimeoutSecs: 60,
    pricePerThousand: 25,
    currency: 'USD',
    status: {
      phase: 'ENDED',
      startedAt: '',
      lastMeterAt: '',
      endedAt: '',
      distanceFt: 10,
      tokens: { unlock: 1, time: 1, distance: 1, total: 3 }
    }
  };

  it('returns null when summary not shown', () => {
    const { container } = render(
      <RideSummaryDisplay showSummary={false} isRideActive={false} rideStateData={undefined} distance={0} elapsedTime="" onDismissSummary={() => {}} />
    );
    expect(container.firstChild).to.be.null;
  });

  it('calls dismiss handler', () => {
    let called = false;
    const dismiss = () => { called = true; };
    render(
      <RideSummaryDisplay showSummary isRideActive={false} rideStateData={baseData} distance={5} elapsedTime="00:10" onDismissSummary={dismiss} />
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss summary/i }));
    expect(called).to.be.true;
  });
});
