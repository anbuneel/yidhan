import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { InstallPrompt } from './InstallPrompt';

describe('InstallPrompt', () => {
  const mockOnInstall = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockOnInstall.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the install prompt', () => {
    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Add Zenote to your device')).toBeInTheDocument();
    expect(screen.getByText('Quick access, works offline')).toBeInTheDocument();
  });

  it('animates in after delay', async () => {
    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    // Initially not visible (opacity-0)
    const container = screen.getByText('Add Zenote to your device').closest('div[class*="fixed"]');
    expect(container).toHaveClass('opacity-0');

    // Advance timer to trigger animation (wrapped in act)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(container).toHaveClass('opacity-100');
  });

  it('calls onInstall when install button is clicked', async () => {
    vi.useRealTimers(); // Use real timers for async test
    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /install/i }));

    await waitFor(() => {
      expect(mockOnInstall).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onDismiss when close button is clicked', async () => {
    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    // Wait for animation timeout (300ms) - wrapped in act
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows loading state during install', async () => {
    vi.useRealTimers();
    mockOnInstall.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
    );

    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /install/i }));

    await waitFor(() => {
      expect(screen.getByText('Installing...')).toBeInTheDocument();
    });
  });

  it('has aria-busy attribute during install', async () => {
    vi.useRealTimers();
    mockOnInstall.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
    );

    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    const installButton = screen.getByRole('button', { name: /install/i });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(installButton).toHaveAttribute('aria-busy', 'true');
    });
  });

  it('disables install button during install', async () => {
    vi.useRealTimers();
    mockOnInstall.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
    );

    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    const installButton = screen.getByRole('button', { name: /install/i });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(installButton).toBeDisabled();
    });
  });

  it('re-enables button if install fails', async () => {
    vi.useRealTimers();
    mockOnInstall.mockResolvedValue(false);

    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    const installButton = screen.getByRole('button', { name: /install/i });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(installButton).not.toBeDisabled();
    });
  });

  it('has accessible dismiss button', () => {
    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissButton).toBeInTheDocument();
    expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss');
  });

  it('renders phone icon', () => {
    render(<InstallPrompt onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    // Check for SVG (phone icon)
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
