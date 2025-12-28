import '@testing-library/jest-dom/vitest';
import { vi, beforeEach, afterEach } from 'vitest';
import { resetIdCounter } from './factories';

/**
 * Global test setup
 * Provides common mocks and utilities for all tests
 */

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage (separate instance to avoid shared state with localStorage)
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock clipboard API
// Note: We use configurable: true to allow user-event library to override
const clipboardMock = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
  write: vi.fn().mockResolvedValue(undefined),
  read: vi.fn().mockResolvedValue([]),
};

Object.defineProperty(navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
  configurable: true,
});

// Mock window.matchMedia (for theme detection and responsive tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private callback: IntersectionObserverCallback) {}

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);

  // Helper to trigger intersection (for tests)
  triggerIntersection(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this);
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  triggerResize(entries: Partial<ResizeObserverEntry>[]) {
    this.callback(entries as ResizeObserverEntry[], this);
  }
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock URL.createObjectURL and revokeObjectURL (for file downloads)
Object.defineProperty(URL, 'createObjectURL', {
  value: vi.fn().mockReturnValue('blob:mock-url'),
  writable: true,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  value: vi.fn(),
  writable: true,
});

// Mock import.meta.env for tests
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  vi.clearAllMocks();
  resetIdCounter();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Export mocks for direct access in tests
export { localStorageMock, sessionStorageMock, clipboardMock };
