import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMockNote } from '../test/factories';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { NoteCard } from './NoteCard';
import { TagBadge } from './TagBadge';
import { ACTIVE_DARK_THEME, ACTIVE_LIGHT_THEME } from '../themes';

// The fixes the three design reviews agreed on (themes plan, PR 3). Each block
// checks first where the old style must no longer appear, then where it should.

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');
const indexCss = read('src/index.css');
const indexHtml = read('index.html');
const landing = read('src/components/LandingPage.tsx');

function sourceFiles(dir: string): string[] {
  return readdirSync(resolve(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(resolve(root, path)).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}
// The changelog quotes old release notes; it is copy, not style.
const sources = sourceFiles('src').filter((f) => !f.replace(/\\/g, '/').endsWith('src/data/changelog.ts'));

/** The body of the first CSS rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[2];
  if (body === undefined) throw new Error(`No rule for ${selector}`);
  return body;
}

const renderCard = () =>
  render(
    <NoteCard
      note={createMockNote({ id: 'n1', title: 'A thought', tags: [{ id: 't1', name: 'Work', color: 'forest', createdAt: new Date() }] })}
      onClick={vi.fn()}
      onDelete={vi.fn()}
      onTogglePin={vi.fn()}
    />
  );

describe('the leaf corner', () => {
  const LEAF = /2px[ _]\d+px[ _]4px[ _]\d+px/;

  it('is not written out by hand anywhere but its token', () => {
    const literal = sources.filter((f) => {
      const text = read(f).replace('--radius-card: 2px 24px 4px 24px;', '');
      return LEAF.test(text);
    });
    expect(literal).toEqual([]);
  });

  it('is not used by modals, menus, buttons or other surfaces', () => {
    const allowed = ['NoteCard.tsx', 'SwipeableNoteCard.tsx', 'FadedNoteCard.tsx', 'LandingPage.tsx', 'index.css'];
    const users = sources.filter((f) => read(f).includes('var(--radius-card)'));
    expect(users.filter((f) => !allowed.some((a) => f.endsWith(a)))).toEqual([]);
    // In the stylesheets, only the editor sheet, the landing manuscript and the sample card.
    expect(indexCss.match(/var\(--radius-card\)/g)).toHaveLength(1);
    expect(rule(indexCss, '.editor-writing-area')).toContain('var(--radius-card)');
    expect(landing.match(/var\(--radius-card\)/g)).toHaveLength(2);
    expect(rule(landing, '.landing-manuscript')).toContain('var(--radius-card)');
  });

  it('is not on a modal, a tag chip or a button in the page', () => {
    render(<KeyboardShortcutsModal isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('dialog').getAttribute('style') ?? '').not.toContain('--radius-card');
    const { container } = render(<TagBadge tag={{ id: 't', name: 'Chip', color: 'gold', createdAt: new Date() }} />);
    expect((container.firstChild as HTMLElement).style.borderRadius).toBe('var(--radius-pill)');
  });

  it('is on a note card', () => {
    const { container } = renderCard();
    expect((container.querySelector('.note-card') as HTMLElement).style.borderRadius).toBe('var(--radius-card)');
  });

  it('is on the shell manuscript only, and the shell CTA is a pill', () => {
    expect(indexHtml.match(LEAF_GLOBAL)).toHaveLength(1);
    expect(rule(indexHtml, '.boot-manuscript')).toContain('border-radius: 2px 24px 4px 24px');
    expect(rule(indexHtml, '.boot-cta')).toContain('border-radius: 9999px');
    expect(rule(landing, '.landing-cta')).toContain('border-radius: var(--radius-pill)');
  });

  it('leaves the plain radii at one value each', () => {
    expect(indexCss).toMatch(/--radius-pill: 9999px;/);
    expect(indexCss).toMatch(/--radius-input: 8px;/);
    expect(indexCss).toMatch(/--radius-plain: 12px;/);
  });
});
const LEAF_GLOBAL = /2px[ _]\d+px[ _]4px[ _]\d+px/g;

describe('labels', () => {
  it('are never set in capital letters or letter-spaced', () => {
    const offenders = sources.filter((f) =>
      /\buppercase\b|textTransform: 'uppercase'|text-transform: uppercase|\btracking-(wide|wider|widest|\[)/.test(read(f))
    );
    expect(offenders).toEqual([]);
    expect(indexHtml).not.toMatch(/text-transform: uppercase/);
  });

  it('do not appear in capitals on a card: the date is italic and the tag chip plain', () => {
    const { container } = renderCard();
    const time = container.querySelector('time') as HTMLElement;
    expect(time.className).not.toMatch(/uppercase|tracking/);
    expect(time.className).toMatch(/\bitalic\b/);
    const chip = screen.getByText('Work');
    expect(chip.className).not.toMatch(/uppercase|tracking/);
  });

  it('section headings in the shortcuts modal are italic, not capitals', () => {
    render(<KeyboardShortcutsModal isOpen onClose={vi.fn()} />);
    for (const heading of screen.getAllByRole('heading', { level: 3 })) {
      expect(heading.className).not.toMatch(/uppercase|tracking/);
    }
  });
});

describe('buttons and calls to action', () => {
  it('cast no coloured shadow', () => {
    const offenders = sources.filter((f) => {
      const text = read(f);
      return (
        /boxShadow:[^,\n]*\d+px \d+px[^'`\n]*(accent-glow|\$\{colorValue\})/.test(text) ||
        /box-shadow:[^;]*\d+px \d+px[^;]*accent-glow/.test(text.replace(/@keyframes resolve-glow \{[\s\S]*?\n\}/, ''))
      );
    });
    expect(offenders).toEqual([]);
    expect(rule(landing, '.landing-cta')).not.toContain('box-shadow');
    expect(rule(landing, '.landing-cta:hover')).not.toContain('box-shadow');
    expect(rule(indexHtml, '.boot-cta')).not.toContain('box-shadow');
    expect(indexHtml).not.toContain('--b-glow');
  });

  it('leave no tinted band behind Pinned', () => {
    expect(read('src/components/ChapterSection.tsx')).not.toMatch(/isPinned \? \{[^}]*background/);
  });
});

describe('shadows at night', () => {
  it('use the theme tokens, not Tailwind presets that stay black in dark', () => {
    const offenders = sources.filter((f) => f.endsWith('.tsx') && /(^|[\s"'`])shadow(-(sm|md|lg|xl|2xl))?(?=[\s"'`])/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe('body weight', () => {
  it('is never 300', () => {
    const offenders = sources.filter((f) => /fontWeight: 300|font-weight: 300|\bfont-light\b/.test(read(f)));
    expect(offenders).toEqual([]);
    expect(indexHtml).not.toMatch(/font-weight: 300/);
  });

  it('is 400 for the body, card previews and the shell paragraphs', () => {
    expect(rule(indexCss, 'body')).toContain('font-weight: 400');
    expect(rule(indexCss, '.note-card-preview')).toContain('font-weight: 400');
    expect(rule(indexHtml, '.boot-intro p')).toContain('font-weight: 400');
  });
});

describe('the editor glow', () => {
  it('takes its colour from the per-theme glow token, in the editor and the landing sample', () => {
    const glow = rule(indexCss, '.editor-manuscript-glow');
    expect(glow).toContain('var(--color-editor-glow)');
    expect(glow).not.toContain('--color-accent');
    expect(glow).not.toContain('--color-text-primary');
    const landingGlow = rule(landing, '.landing-manuscript-glow');
    expect(landingGlow).toContain('var(--color-editor-glow)');
    expect(landingGlow).not.toContain('--color-accent');
  });

  it('is a faint leaf green in light, because nothing is lighter than the white sheet', () => {
    expect(ACTIVE_LIGHT_THEME.colors.editorGlow).toBe('rgba(53, 122, 69, 0.08)');
    expect(ACTIVE_LIGHT_THEME.colors.accent).toBe('#357A45');
  });

  it('stays neutral in dark: the text colour at 4%, no green', () => {
    expect(ACTIVE_DARK_THEME.colors.editorGlow).toBe('rgba(230, 227, 220, 0.04)');
    expect(ACTIVE_DARK_THEME.colors.textPrimary).toBe('#E6E3DC');
  });
});

describe('the landing sample "Saved here"', () => {
  it('is not tinted green: italic neutral text with its tick', () => {
    const saved = rule(landing, '.landing-saved');
    expect(saved).not.toMatch(/--color-success|background/);
    expect(saved).toContain('color: var(--color-text-secondary)');
    expect(saved).toContain('font-style: italic');
  });
});

describe('old theme names in code', () => {
  it('no keyframe or comment cites kintsugi or wabi-sabi', () => {
    const offenders = sources.filter((f) => /kintsugi|wabi-sabi/i.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
