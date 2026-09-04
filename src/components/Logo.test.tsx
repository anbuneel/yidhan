import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Logo } from './Logo';

describe('Logo', () => {
  it('renders the wordmark with a decorative, theme-tinted mark', () => {
    render(<Logo />);

    expect(screen.getByText('Yidhan')).toBeInTheDocument();
    const mark = screen.getByTestId('brand-logo-mark');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveClass('brand-mark');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders as a button named by alt when onClick is provided', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Logo onClick={onClick} alt="Back to library" />);

    const button = screen.getByRole('button', { name: 'Back to library' });
    expect(button).toContainElement(screen.getByTestId('brand-logo-mark'));

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies className to the outer element in both modes', () => {
    const { unmount } = render(<Logo className="mb-12" />);
    expect(screen.getByText('Yidhan').parentElement?.parentElement).toHaveClass('mb-12');
    unmount();

    render(<Logo className="shrink-0" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Yidhan' })).toHaveClass('shrink-0');
  });
});
