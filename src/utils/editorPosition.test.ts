import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveCursorPosition,
  saveScrollPosition,
  saveEditorPosition,
  getEditorPosition,
  clearEditorPosition,
  isScrollPositionFar,
  createThrottledSave,
} from './editorPosition';

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  }),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('editorPosition', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('saveCursorPosition', () => {
    it('saves cursor position to localStorage', () => {
      saveCursorPosition('note-1', { from: 10, to: 20 });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const stored = JSON.parse(mockStorage['yidhan-editor-positions']);
      expect(stored['note-1'].cursor).toEqual({ from: 10, to: 20 });
    });

    it('preserves existing scroll position when saving cursor', () => {
      // First save scroll
      saveScrollPosition('note-1', 500);
      // Then save cursor
      saveCursorPosition('note-1', { from: 10, to: 20 });

      const stored = JSON.parse(mockStorage['yidhan-editor-positions']);
      expect(stored['note-1'].scroll).toBe(500);
      expect(stored['note-1'].cursor).toEqual({ from: 10, to: 20 });
    });
  });

  describe('saveScrollPosition', () => {
    it('saves scroll position to localStorage', () => {
      saveScrollPosition('note-1', 300);

      const stored = JSON.parse(mockStorage['yidhan-editor-positions']);
      expect(stored['note-1'].scroll).toBe(300);
    });

    it('preserves existing cursor position when saving scroll', () => {
      // First save cursor
      saveCursorPosition('note-1', { from: 10, to: 20 });
      // Then save scroll
      saveScrollPosition('note-1', 300);

      const stored = JSON.parse(mockStorage['yidhan-editor-positions']);
      expect(stored['note-1'].cursor).toEqual({ from: 10, to: 20 });
      expect(stored['note-1'].scroll).toBe(300);
    });
  });

  describe('saveEditorPosition', () => {
    it('saves both cursor and scroll together', () => {
      saveEditorPosition('note-1', { from: 5, to: 15 }, 250);

      const stored = JSON.parse(mockStorage['yidhan-editor-positions']);
      expect(stored['note-1'].cursor).toEqual({ from: 5, to: 15 });
      expect(stored['note-1'].scroll).toBe(250);
    });
  });

  describe('getEditorPosition', () => {
    it('returns null when no position is stored', () => {
      const result = getEditorPosition('non-existent');
      expect(result).toBeNull();
    });

    it('returns stored position', () => {
      saveEditorPosition('note-1', { from: 10, to: 20 }, 300);

      const result = getEditorPosition('note-1');
      expect(result).toEqual({
        cursor: { from: 10, to: 20 },
        scroll: 300,
        updatedAt: expect.any(Number),
      });
    });

    it('returns null for expired positions', () => {
      // Save position with old timestamp
      const oldTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago
      mockStorage['yidhan-editor-positions'] = JSON.stringify({
        'note-1': {
          cursor: { from: 10, to: 20 },
          scroll: 300,
          updatedAt: oldTimestamp,
        },
      });

      const result = getEditorPosition('note-1');
      expect(result).toBeNull();
    });
  });

  describe('clearEditorPosition', () => {
    it('removes position for a specific note', () => {
      saveEditorPosition('note-1', { from: 10, to: 20 }, 300);
      saveEditorPosition('note-2', { from: 5, to: 5 }, 100);

      clearEditorPosition('note-1');

      expect(getEditorPosition('note-1')).toBeNull();
      expect(getEditorPosition('note-2')).not.toBeNull();
    });
  });

  describe('isScrollPositionFar', () => {
    it('returns false when no position is stored', () => {
      expect(isScrollPositionFar('non-existent')).toBe(false);
    });

    it('returns false when scroll is below threshold', () => {
      saveScrollPosition('note-1', 400);
      expect(isScrollPositionFar('note-1', 500)).toBe(false);
    });

    it('returns true when scroll is above threshold', () => {
      saveScrollPosition('note-1', 600);
      expect(isScrollPositionFar('note-1', 500)).toBe(true);
    });

    it('uses default threshold of 500', () => {
      saveScrollPosition('note-1', 501);
      expect(isScrollPositionFar('note-1')).toBe(true);
    });
  });

  describe('createThrottledSave', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls save function immediately on first call', () => {
      const saveFn = vi.fn();
      const throttled = createThrottledSave(saveFn, 1000);

      throttled.save();

      expect(saveFn).toHaveBeenCalledTimes(1);
    });

    it('throttles subsequent calls', () => {
      const saveFn = vi.fn();
      const throttled = createThrottledSave(saveFn, 1000);

      throttled.save();
      throttled.save();
      throttled.save();

      expect(saveFn).toHaveBeenCalledTimes(1);

      // Fast-forward 1 second
      vi.advanceTimersByTime(1000);

      expect(saveFn).toHaveBeenCalledTimes(2);
    });

    it('flush() executes pending save immediately', () => {
      const saveFn = vi.fn();
      const throttled = createThrottledSave(saveFn, 1000);

      throttled.save(); // First call - immediate
      throttled.save(); // Second call - pending

      expect(saveFn).toHaveBeenCalledTimes(1);

      throttled.flush();

      expect(saveFn).toHaveBeenCalledTimes(2);
    });

    it('flush() does nothing when no pending save', () => {
      const saveFn = vi.fn();
      const throttled = createThrottledSave(saveFn, 1000);

      throttled.flush();

      expect(saveFn).not.toHaveBeenCalled();
    });

    it('cancel() prevents pending save from executing', () => {
      const saveFn = vi.fn();
      const throttled = createThrottledSave(saveFn, 1000);

      throttled.save(); // First call - immediate
      throttled.save(); // Second call - pending
      throttled.cancel();

      vi.advanceTimersByTime(2000);

      expect(saveFn).toHaveBeenCalledTimes(1);
    });

    it('allows immediate save after delay has passed', () => {
      const saveFn = vi.fn();
      const throttled = createThrottledSave(saveFn, 1000);

      throttled.save();
      expect(saveFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);

      throttled.save();
      expect(saveFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('storage limits', () => {
    it('limits storage to max entries', () => {
      // Save 105 positions (over the 100 limit)
      // Use different base timestamps to ensure unique updatedAt values
      const baseTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => baseTime);

      for (let i = 0; i < 105; i++) {
        // Increment mock time for each save to ensure different timestamps
        vi.spyOn(Date, 'now').mockImplementation(() => baseTime + i);
        saveEditorPosition(`note-${i}`, { from: i, to: i }, i * 10);
      }

      vi.restoreAllMocks();

      const stored = JSON.parse(mockStorage['yidhan-editor-positions']);
      const noteCount = Object.keys(stored).length;

      // Should be at most 100 entries
      expect(noteCount).toBeLessThanOrEqual(100);
    });
  });

  describe('rapid note switching', () => {
    it('does not mix scroll data when switching notes rapidly', () => {
      saveScrollPosition('note-1', 100);
      saveScrollPosition('note-2', 200);
      saveScrollPosition('note-1', 150); // Update note-1 again

      const pos1 = getEditorPosition('note-1');
      const pos2 = getEditorPosition('note-2');

      expect(pos1?.scroll).toBe(150);
      expect(pos2?.scroll).toBe(200);
    });

    it('does not mix cursor data when switching notes rapidly', () => {
      saveCursorPosition('note-1', { from: 10, to: 20 });
      saveCursorPosition('note-2', { from: 30, to: 40 });
      saveCursorPosition('note-1', { from: 15, to: 25 }); // Update note-1 again

      const pos1 = getEditorPosition('note-1');
      const pos2 = getEditorPosition('note-2');

      expect(pos1?.cursor).toEqual({ from: 15, to: 25 });
      expect(pos2?.cursor).toEqual({ from: 30, to: 40 });
    });

    it('maintains data integrity across interleaved saves', () => {
      // Simulate rapid interleaved saves for multiple notes
      for (let i = 0; i < 10; i++) {
        saveCursorPosition('note-a', { from: i, to: i + 1 });
        saveScrollPosition('note-b', i * 100);
        saveCursorPosition('note-b', { from: i * 2, to: i * 2 + 1 });
        saveScrollPosition('note-a', i * 50);
      }

      const posA = getEditorPosition('note-a');
      const posB = getEditorPosition('note-b');

      // Should have the final values for each note
      expect(posA?.cursor).toEqual({ from: 9, to: 10 });
      expect(posA?.scroll).toBe(450);
      expect(posB?.cursor).toEqual({ from: 18, to: 19 });
      expect(posB?.scroll).toBe(900);
    });
  });

  describe('runtime validation', () => {
    it('handles corrupted localStorage data gracefully', () => {
      // Simulate corrupted data
      mockStorage['yidhan-editor-positions'] = 'not valid json {{{';

      const result = getEditorPosition('any-note');
      expect(result).toBeNull();
    });

    it('filters out invalid entries while keeping valid ones', () => {
      // Mix of valid and invalid entries
      mockStorage['yidhan-editor-positions'] = JSON.stringify({
        'valid-note': {
          cursor: { from: 10, to: 20 },
          scroll: 100,
          updatedAt: Date.now(),
        },
        'invalid-note-1': {
          cursor: 'not an object', // Invalid cursor
          scroll: 100,
          updatedAt: Date.now(),
        },
        'invalid-note-2': {
          cursor: { from: 10, to: 20 },
          scroll: 'not a number', // Invalid scroll
          updatedAt: Date.now(),
        },
        'invalid-note-3': null, // Null entry
        'invalid-note-4': {
          cursor: { from: 10 }, // Missing 'to'
          scroll: 100,
          updatedAt: Date.now(),
        },
      });

      // Valid note should still be retrievable
      const validResult = getEditorPosition('valid-note');
      expect(validResult).not.toBeNull();
      expect(validResult?.cursor).toEqual({ from: 10, to: 20 });

      // Invalid notes should return null
      expect(getEditorPosition('invalid-note-1')).toBeNull();
      expect(getEditorPosition('invalid-note-2')).toBeNull();
      expect(getEditorPosition('invalid-note-3')).toBeNull();
      expect(getEditorPosition('invalid-note-4')).toBeNull();
    });

    it('handles non-object localStorage data', () => {
      mockStorage['yidhan-editor-positions'] = JSON.stringify('just a string');
      expect(getEditorPosition('any-note')).toBeNull();

      mockStorage['yidhan-editor-positions'] = JSON.stringify(null);
      expect(getEditorPosition('any-note')).toBeNull();

      mockStorage['yidhan-editor-positions'] = JSON.stringify([1, 2, 3]);
      expect(getEditorPosition('any-note')).toBeNull();
    });
  });

  describe('createThrottledSave edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('handles zero delay gracefully', () => {
      const saveFn = vi.fn();
      const throttled = createThrottledSave(saveFn, 0);

      throttled.save();
      throttled.save();
      throttled.save();

      // With zero delay, should execute immediately each time
      expect(saveFn).toHaveBeenCalledTimes(3);
    });

    it('cancel clears pending flag so flush does nothing', () => {
      const saveFn = vi.fn();
      const throttled = createThrottledSave(saveFn, 1000);

      throttled.save(); // Immediate
      throttled.save(); // Pending
      throttled.cancel();
      throttled.flush();

      // Only the first immediate call should have executed
      expect(saveFn).toHaveBeenCalledTimes(1);
    });
  });
});
