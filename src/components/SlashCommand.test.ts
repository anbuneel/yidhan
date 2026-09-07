import { describe, expect, it } from 'vitest';
import { getSlashMenuPosition } from '../editor/slashMenuPosition';

describe('getSlashMenuPosition', () => {
  it('flips above a bottom anchor and clamps inside a 390px mobile viewport', () => {
    const position = getSlashMenuPosition(
      { top: 540, bottom: 560, left: 360, right: 380, width: 20, height: 20 },
      { width: 320, height: 280 },
      { width: 390, height: 600 },
    );

    expect(position.placement).toBe('above');
    expect(position.left).toBe(62);
    expect(position.top).toBe(252);
    expect(position.left + 320).toBeLessThanOrEqual(382);
    expect(position.top + 280).toBeLessThanOrEqual(592);
  });

  it('uses the space below and clamps a left-edge anchor', () => {
    expect(getSlashMenuPosition(
      { top: 20, bottom: 40, left: -12, right: 8, width: 20, height: 20 },
      { width: 240, height: 180 },
      { width: 390, height: 600 },
    )).toMatchObject({ placement: 'below', left: 8, top: 48 });
  });
});
