import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Logo } from './Logo';
import { LogoMark } from './LogoMark';
import { SMALL_MARK_MAX_PX, markDrawingFor } from './logoSizeRule';
import { FULL_MARK, MARIGOLD, SMALL_MARK, WORDMARK } from './logoPaths';
import {
  SMALL_MARK_VIEWBOX,
  SPRITE_MARK_SMALL,
  SPRITE_WORDMARK,
  WORDMARK_ASPECT,
  WORDMARK_VIEWBOX,
} from './logoSprite';

const pathsIn = (root: Element) => Array.from(root.querySelectorAll('path'));
// The letter in the sun is retired (owner, 2026-11-11). A mark with one would hold a
// path that is neither the sun nor the leaf.
const hasLetter = (root: Element) =>
  root.querySelector('[data-part="letter"]') !== null ||
  pathsIn(root).some((p) => ![FULL_MARK.sun, FULL_MARK.leaf].includes(p.getAttribute('d') ?? ''));
const uses = (root: Element) => Array.from(root.querySelectorAll('use')).map((u) => u.getAttribute('href'));

describe('Logo: where the letter must not appear', () => {
  it.each([16, 32, SMALL_MARK_MAX_PX, SMALL_MARK_MAX_PX + 1, 64, 127, 128, 512, 1024])(
    'a %ipx mark holds no letter path',
    (size) => {
      const { container } = render(<LogoMark size={size} />);
      expect(hasLetter(container)).toBe(false);
      expect(container.querySelector('[data-part="letter"]')).toBeNull();
    },
  );

  it('the header lockup draws the small mark and holds no letter path', () => {
    const { container } = render(<Logo />);
    expect(hasLetter(container)).toBe(false);
    // Header sizes (30 and 36px) are under 48: the two-line small drawing, from the sprite.
    expect(uses(container)).toEqual([SPRITE_MARK_SMALL, SPRITE_WORDMARK]);
  });

  it('the clickable header logo holds no letter path', () => {
    const { container } = render(<Logo onClick={() => {}} />);
    expect(hasLetter(container)).toBe(false);
  });

  it('the header logo carries no path data of its own: it all comes from the sprite', () => {
    const { container } = render(<Logo />);
    expect(pathsIn(container)).toHaveLength(0);
  });

  it('a decorative mark exposes no image role', () => {
    render(<LogoMark size={200} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('brand-logo-mark')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Logo: size rule', () => {
  it('picks the small drawing to 48px and the full drawing from 49px', () => {
    expect(markDrawingFor(16)).toBe('small');
    expect(markDrawingFor(48)).toBe('small');
    expect(markDrawingFor(49)).toBe('full');
    expect(markDrawingFor(128)).toBe('full');
    expect(markDrawingFor(1024)).toBe('full');
  });

  it.each([128, 512])('a %ipx mark draws the sun and the leaf, and nothing else', (size) => {
    const { container } = render(<LogoMark size={size} />);
    expect(pathsIn(container).map((p) => p.getAttribute('d'))).toEqual([FULL_MARK.sun, FULL_MARK.leaf]);
  });

  it('a small mark uses the sprite; larger sizes draw the full paths', () => {
    const { container, unmount } = render(<LogoMark size={32} />);
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', SMALL_MARK_VIEWBOX);
    expect(uses(container)).toEqual([SPRITE_MARK_SMALL]);
    unmount();

    const big = render(<LogoMark size={96} />);
    expect(big.container.querySelector('svg')).toHaveAttribute('viewBox', FULL_MARK.viewBox);
    expect(pathsIn(big.container).map((p) => p.getAttribute('d'))).toEqual([FULL_MARK.sun, FULL_MARK.leaf]);
  });

  it('sprite viewBoxes match the generated paths', () => {
    expect(SMALL_MARK_VIEWBOX).toBe(SMALL_MARK.viewBox);
    expect(WORDMARK_VIEWBOX).toBe(WORDMARK.viewBox);
    const [, , w, h] = WORDMARK.viewBox.split(' ');
    expect(WORDMARK_ASPECT).toBe(`${w} / ${h}`);
  });
});

describe('Logo: accessible name', () => {
  it('renders mark and wordmark as SVG, named "Yidhan" once, with the mark decorative', () => {
    render(<Logo />);

    const [mark, word] = Array.from(document.querySelectorAll('svg'));
    expect(mark.tagName.toLowerCase()).toBe('svg');
    expect(word.tagName.toLowerCase()).toBe('svg');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    // One named image: the wordmark. The mark beside it adds nothing to the name.
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Yidhan' })).toBe(word);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // No text node and no raster: the wordmark is a path.
    expect(screen.queryByText('Yidhan')).not.toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('a standalone mark with a label is an image named by it', () => {
    render(<LogoMark size={128} label="Yidhan" />);
    expect(screen.getByRole('img', { name: 'Yidhan' })).toBe(screen.getByTestId('brand-logo-mark'));
  });

  it('renders as a button named by alt when onClick is provided', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();
    render(<Logo onClick={onClick} alt="Back to library" />);

    const button = screen.getByRole('button', { name: 'Back to library' });
    expect(button.querySelectorAll('svg')).toHaveLength(2);

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies className to the outer element in both modes', () => {
    const { container, unmount } = render(<Logo className="mb-12" />);
    expect(container.firstChild).toHaveClass('mb-12');
    unmount();

    render(<Logo className="shrink-0" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Yidhan' })).toHaveClass('shrink-0');
  });
});

describe('Logo: colours of the larger mark', () => {
  it.each([96, 256])('%ipx: every fill is a theme token except the marigold sun', (size) => {
    const { container } = render(<LogoMark size={size} />);
    const all = pathsIn(container);
    expect(all.length).toBeGreaterThan(0);
    for (const p of all) {
      // No colour baked into an attribute, where a token could not reach it.
      expect(p.getAttribute('fill')).toBeNull();
      if (p.getAttribute('d') === FULL_MARK.sun) {
        expect(p.style.fill.toUpperCase()).toBe(MARIGOLD.toUpperCase());
      } else {
        expect(p.style.fill).toMatch(/^var\(--color-[a-z-]+\)$/);
      }
    }
  });

  it('the leaf takes the leaf token', () => {
    const { container } = render(<LogoMark size={128} />);
    const fill = (d: string) => pathsIn(container).find((p) => p.getAttribute('d') === d)!.style.fill;
    expect(fill(FULL_MARK.leaf)).toBe('var(--color-brand-leaf)');
  });
});
