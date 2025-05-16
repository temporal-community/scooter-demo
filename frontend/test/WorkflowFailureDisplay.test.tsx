import { expect } from 'chai';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkflowFailureDisplay } from '../src/components/Hud/WorkflowFailureDisplay.tsx';

describe('WorkflowFailureDisplay', () => {
  const baseData = {
    status: {
      phase: 'FAILED',
      lastError: 'ACCOUNT_NOT_FOUND'
    }
  } as any;

  it('returns null when phase not FAILED', () => {
    const { container } = render(
      <WorkflowFailureDisplay rideStateData={{ status: { phase: 'ACTIVE' } } as any} email="" setEmail={() => {}} emailError="" setEmailError={() => {}} onRetry={() => {}} isRetrying={false} validateEmail={() => ({ isValid: true })} />
    );
    expect(container.firstChild).to.be.null;
  });

  it('calls onRetry when button clicked with valid email', () => {
    let called = false;
    const onRetry = () => { called = true; };
    render(
      <WorkflowFailureDisplay rideStateData={baseData} email="a@b.c" setEmail={() => {}} emailError="" setEmailError={() => {}} onRetry={onRetry} isRetrying={false} validateEmail={() => ({ isValid: true })} />
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(called).to.be.true;
  });
});
