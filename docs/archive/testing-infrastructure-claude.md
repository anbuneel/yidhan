# Testing Infrastructure Explained

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-27

---

## Original Prompt

> For my own learning, how are the tests executed headlessly? What is the tech stack behind these tests?

---

## Test Tech Stack

### 1. Vitest (Test Runner)

```bash
npm run test:run  # Runs tests once
npm run test      # Watch mode
```

Vitest is a Vite-native test runner that:
- Runs in Node.js (no real browser needed)
- Uses the same Vite config for fast transforms
- Compatible with Jest API (`describe`, `it`, `expect`)

### 2. jsdom (Headless DOM)

Configured in `vite.config.ts`:
```typescript
test: {
  environment: 'jsdom',  // ← Simulates browser DOM in Node.js
}
```

**jsdom** is a pure JavaScript implementation of web standards (DOM, HTML, CSS) that runs in Node.js. When a test does:
```typescript
render(<Button />);
screen.getByText('Click me');
```

It's actually manipulating a virtual DOM in memory - no browser window opens.

### 3. React Testing Library (Component Testing)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

render(<Auth {...props} />);
await userEvent.click(screen.getByText('Sign In'));
```

RTL provides:
- `render()` - Mounts React components into jsdom
- `screen` - Queries the virtual DOM (`getByText`, `getByRole`, etc.)
- `userEvent` - Simulates realistic user interactions (typing, clicking)

### 4. vi (Vitest Mocking)

```typescript
// Mock entire modules
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Spy on specific methods
vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

// Fake timers for debounce testing
vi.useFakeTimers();
vi.advanceTimersByTime(1500);
```

---

## How It All Fits Together

```
┌─────────────────────────────────────────────────────────┐
│                     Node.js Process                      │
├─────────────────────────────────────────────────────────┤
│  Vitest (test runner)                                   │
│    ├── Transforms TypeScript/JSX via Vite               │
│    ├── Runs test files in parallel                      │
│    └── Reports results to terminal                      │
├─────────────────────────────────────────────────────────┤
│  jsdom (virtual browser)                                │
│    ├── window, document, localStorage                   │
│    ├── DOM APIs (querySelector, events)                 │
│    └── No actual rendering (no pixels, no layout)       │
├─────────────────────────────────────────────────────────┤
│  React Testing Library                                  │
│    ├── ReactDOM.render() into jsdom                     │
│    ├── Query helpers (getByRole, getByText)             │
│    └── userEvent for interaction simulation             │
└─────────────────────────────────────────────────────────┘
```

---

## What jsdom CAN'T Do

Since there's no real browser:
- No visual rendering (can't screenshot)
- No CSS layout calculations (`getBoundingClientRect` returns zeros)
- No navigation (`window.location` is mocked)
- No real network requests (must mock `fetch`)

For those, you'd use **Playwright** (Phase 6) which controls real browsers.

---

## Example: What Happens When a Test Runs

```typescript
it('submits login form', async () => {
  render(<Auth />);
  // 1. React renders <Auth> into jsdom's virtual document.body

  await userEvent.type(screen.getByRole('textbox'), 'test@example.com');
  // 2. userEvent dispatches keydown/keyup/input events to jsdom
  // 3. React handles onChange, updates state
  // 4. jsdom's DOM updates with new input value

  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  // 5. userEvent dispatches click event
  // 6. React calls onClick handler
  // 7. Our mocked signIn() is called

  expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password');
  // 8. Vitest assertion checks the mock was called correctly
});
```

---

## Why This Approach?

| Approach | Speed | Realism | Use Case |
|----------|-------|---------|----------|
| jsdom + RTL | ~10ms/test | Medium | Unit/integration tests |
| Playwright | ~1-5s/test | High | E2E, visual testing |

We use jsdom for 95% of tests (fast feedback), and Playwright for critical user journeys (real browser behavior).

---

## Related Files

- `vite.config.ts` - Test environment configuration
- `src/test/setup.ts` - Global mocks (localStorage, clipboard, matchMedia)
- `src/test/mocks/supabase.ts` - Supabase client mocks
- `src/test/factories.ts` - Test data factories
- `docs/plans/automated-testing-implementation-plan.md` - Testing roadmap
