import { describe, expect, it } from 'vitest';
import { getEditorMenuPosition } from './editorMenuPosition';

describe('getEditorMenuPosition', () => {
  it('flips a downward menu above a trigger near the viewport bottom', () => {
    const position = getEditorMenuPosition(
      { top: 550, right: 382, bottom: 582, left: 350, width: 32, height: 32 },
      { width: 320, height: 400 },
      { width: 390, height: 600 },
      'down',
    );

    expect(position.placement).toBe('above');
    expect(position.left).toBeGreaterThanOrEqual(8);
    expect(position.top).toBeGreaterThanOrEqual(8);
    expect(position.top + 400).toBeLessThanOrEqual(592);
  });

  it('flips a rightward sidebar menu left and clamps an oversized menu', () => {
    const position = getEditorMenuPosition(
      { top: 580, right: 382, bottom: 612, left: 350, width: 32, height: 32 },
      { width: 320, height: 900 },
      { width: 390, height: 600 },
      'right',
    );

    expect(position).toMatchObject({ placement: 'left', top: 8, maxHeight: 584 });
    expect(position.left).toBeGreaterThanOrEqual(8);
    expect(position.left + 320).toBeLessThanOrEqual(382);
  });
});
