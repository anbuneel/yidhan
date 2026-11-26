import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { WhisperBack } from './WhisperBack';

const button = () => screen.getByRole('button', { name: 'Scroll to top', hidden: true });

describe('WhisperBack', () => {
  it('lifts above the phone bottom toolbar by the toolbar measured height', () => {
    const toolbar = document.createElement('div');
    Object.defineProperty(toolbar, 'offsetHeight', { configurable: true, value: 63 });
    const ref = createRef<HTMLElement>() as { current: HTMLElement | null };
    ref.current = toolbar;
    render(<WhisperBack bottomToolbarRef={ref} />);
    expect(button().className).toMatch(/whisper-back-above-toolbar/);
    expect(button().style.getPropertyValue('--whisper-toolbar-offset')).toBe('63px');
  });

  it('keeps its plain position where there is no bottom toolbar', () => {
    render(<WhisperBack />);
    expect(button().className).not.toMatch(/whisper-back-above-toolbar/);
    expect(button().style.getPropertyValue('--whisper-toolbar-offset')).toBe('');
  });

  it('sets no offset while the toolbar is hidden (zero height)', () => {
    const toolbar = document.createElement('div');
    const ref = { current: toolbar };
    render(<WhisperBack bottomToolbarRef={ref} />);
    expect(button().style.getPropertyValue('--whisper-toolbar-offset')).toBe('');
  });

  it('adds the keyboard, on phones only, with a safe-area fallback before it measures', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8').replace(/\r\n/g, '\n');
    const start = css.indexOf('.whisper-back-above-toolbar {');
    const rule = css.slice(start, css.indexOf('}', start));
    const phone = css.lastIndexOf('@media (max-width: 767px)', start);
    expect(phone).toBeGreaterThan(-1);
    expect(css.slice(phone, start)).not.toContain('@media (min-width');
    expect(rule).toContain('var(--keyboard-height, 0px)');
    expect(rule).toContain('var(--whisper-toolbar-offset, calc(64px + env(safe-area-inset-bottom, 0px)))');
  });
});
