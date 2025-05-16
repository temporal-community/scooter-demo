import { expect } from 'chai';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RideForm } from '../src/components/Hud/RideForm';

describe('RideForm', () => {
  const defaultProps = {
    email: '',
    setEmail: () => {},
    emailError: '',
    setEmailError: () => {},
    scooterId: '',
    setScooterId: () => {},
    scooterIdError: '',
    setScooterIdError: () => {},
    onStartRide: () => {},
    isRideActive: false,
    isStarting: false,
    showSummary: false,
    validateEmail: () => ({ isValid: true }),
    validateScooterId: () => ({ isValid: true })
  };

  it('hides form when ride is active', () => {
    const { container } = render(<RideForm {...defaultProps} isRideActive />);
    expect(container.firstChild).to.be.null;
  });

  it('calls onStartRide when button clicked with valid inputs', async () => {
    let called = false;
    const onStartRide = () => { called = true; };
    render(<RideForm {...defaultProps} onStartRide={onStartRide} />);

    await userEvent.type(screen.getByLabelText(/scooter id/i), '123');
    await userEvent.type(screen.getByPlaceholderText('maria@example.com'), 'a@b.c');
    fireEvent.click(screen.getByRole('button', { name: /unlock scooter/i }));
    expect(called).to.be.true;
  });

  it('shows error messages', () => {
    render(<RideForm {...defaultProps} scooterIdError="bad" emailError="e" />);
    expect(screen.getByText('bad')).to.exist;
    expect(screen.getByText('e')).to.exist;
  });
});
