import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Footer } from './Footer';

describe('Footer', () => {
  const required = { onChangelogClick: vi.fn(), onRoadmapClick: vi.fn() };

  it('renders the always-present navigation', async () => {
    const user = userEvent.setup({ delay: null });
    const onChangelogClick = vi.fn();
    const onRoadmapClick = vi.fn();
    render(<Footer onChangelogClick={onChangelogClick} onRoadmapClick={onRoadmapClick} />);

    await user.click(screen.getByRole('button', { name: 'Changelog' }));
    await user.click(screen.getByRole('button', { name: 'Roadmap' }));

    expect(onChangelogClick).toHaveBeenCalledTimes(1);
    expect(onRoadmapClick).toHaveBeenCalledTimes(1);
  });

  it('omits the optional links when no handler is given', () => {
    render(<Footer {...required} />);

    // Every optional prop is absent here. A link rendered without a handler
    // would look live and do nothing when clicked.
    expect(screen.queryByRole('button', { name: /shortcuts/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /privacy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /terms/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /support/i })).not.toBeInTheDocument();
  });

  it.each([
    ['onShortcutsClick', /shortcuts/i],
    ['onPrivacyClick', /privacy/i],
    ['onTermsClick', /terms/i],
    ['onSupportClick', /support/i],
  ])('renders and wires %s when supplied', async (prop, label) => {
    const user = userEvent.setup({ delay: null });
    const handler = vi.fn();
    render(<Footer {...required} {...{ [prop]: handler }} />);

    await user.click(screen.getByRole('button', { name: label }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('exposes the footer element through the forwarded ref', () => {
    const ref = { current: null as HTMLElement | null };
    render(<Footer {...required} ref={ref} />);

    // App measures the footer to position the library; a dropped ref makes that
    // silently fall back to a default rather than fail.
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe('FOOTER');
  });

  it('marks the separators as decorative', () => {
    const { container } = render(<Footer {...required} />);

    // The dot separators are read out as "middle dot" by screen readers unless
    // hidden, once per link.
    const separators = container.querySelectorAll('[aria-hidden="true"]');
    expect(separators.length).toBeGreaterThan(0);
  });
});
