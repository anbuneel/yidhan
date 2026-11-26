import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WhisperBack } from './WhisperBack';

describe('WhisperBack', () => {
  it('lifts above the phone bottom toolbar when the toolbar shows', () => {
    render(<WhisperBack aboveBottomToolbar />);
    expect(screen.getByRole('button', { name: 'Scroll to top', hidden: true }).className).toMatch(/whisper-back-above-toolbar/);
  });

  it('keeps its plain position where there is no bottom toolbar', () => {
    render(<WhisperBack />);
    expect(screen.getByRole('button', { name: 'Scroll to top', hidden: true }).className).not.toMatch(/whisper-back-above-toolbar/);
  });

  it('accounts for the keyboard and safe area, on phones only', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    const phone = css.indexOf('@media (max-width: 767px)', css.indexOf('.editor-toolbar-bottom {\n    display: block;') - 40);
    const rule = css.slice(css.indexOf('.whisper-back-above-toolbar {'), css.indexOf('}', css.indexOf('.whisper-back-above-toolbar {')));
    expect(phone).toBeGreaterThan(-1);
    expect(css.indexOf('.whisper-back-above-toolbar {')).toBeGreaterThan(phone);
    expect(rule).toContain('var(--keyboard-height, 0px)');
    expect(rule).toContain('env(safe-area-inset-bottom, 0px)');
    expect(rule).toContain('var(--editor-toolbar-bottom-height');
  });
});
