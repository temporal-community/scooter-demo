import { expect } from 'chai';
import { render, screen } from '@testing-library/react';
import { ErrorMessageDisplay } from '../src/components/Hud/ErrorMessage.tsx';

describe('ErrorMessageDisplay', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<ErrorMessageDisplay message={null} />);
    expect(container.firstChild).to.be.null;
  });

  it('renders provided message', () => {
    render(<ErrorMessageDisplay message="Oops" />);
    expect(screen.getByText('Oops')).to.exist;
  });
});
