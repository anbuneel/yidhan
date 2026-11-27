/**
 * Probes and arithmetic for the timing harness.
 *
 * All timing happens in the page, on the page's own clock. Start times are input
 * event timestamps (`event.timeStamp`), so time an event spent queued behind a
 * busy main thread counts. End times are taken just after the frame that shows
 * the result: the end condition is checked in a requestAnimationFrame callback,
 * and the clock is read in a task posted from it, after that frame's paint.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from '../e2e-sw/productionBuild';

export const CPU_THROTTLE = Number(process.env.PERF_CPU_THROTTLE ?? 4);
export const SAMPLES = Number(process.env.PERF_SAMPLES ?? 5);

export type Condition = 'library' | 'editor' | 'unlocked';

interface LongTask {
  start: number;
  duration: number;
}

export interface Span {
  ms: number;
  longTasks: number;
  tbtMs: number;
  longestTaskMs: number;
  /** Longest gap between animation frames in the window: how long a spinner froze. */
  maxFrameGapMs?: number;
  /** Only for `unlocked`: which screen ended the wait. */
  endedOn?: string;
}

/**
 * Installed with addInitScript, so it runs before any app code on every page.
 * Runs in the browser: it must not reference anything outside its own body.
 */
function probe(options: { bootLibrary?: boolean } = {}): void {
  type W = Window & { __perf?: unknown };
  const w = window as W;
  if (w.__perf) return;

  const longTasks: LongTask[] = [];
  const record = (entries: PerformanceEntryList) => {
    for (const e of entries) longTasks.push({ start: e.startTime, duration: e.duration });
  };
  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => record(list.getEntries()));
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    // No Long Tasks API: counts read as zero.
  }

  function check(condition: Condition): string | null {
    const library = document.querySelector('[data-testid="library-view"]');
    // An empty account's empty state is not inside a library-view element.
    const empty = () => (document.body.textContent?.includes('Your notes await') ? 'library-empty' : null);
    const heading = (text: string) =>
      Array.from(document.querySelectorAll('h1, h2')).some((h) => h.textContent?.trim() === text);
    if (condition === 'library') {
      if (library && library.getAttribute('aria-busy') !== 'true' && library.querySelector('.note-card')) {
        return 'library';
      }
      if (!library && empty()) return 'library-empty';
      // Signed in, a reload can show the unlock form while the stored keys are
      // checked. frameWhen only accepts this once it has held for a while.
      return heading('Unlock your notes') ? 'unlock-gate' : null;
    }
    if (condition === 'editor') {
      const body = document.querySelector<HTMLElement>(
        '[data-testid="note-editor"] .ProseMirror[contenteditable="true"]'
      );
      return body && body.offsetParent !== null ? 'editor' : null;
    }
    // unlocked: the library, or the recovery-key offer that can stand in front of it.
    if (library && library.getAttribute('aria-busy') !== 'true') return 'library';
    if (!library && empty()) return 'library-empty';
    return heading('Make a recovery key') ? 'recovery-offer' : null;
  }

  /** How long the unlock form must stay up before a reload counts as a failed restore. */
  const UNLOCK_GATE_HOLD_MS = 5000;

  /** Run `then` two tasks after now, so a render scheduled by this frame's work is in. */
  function afterTwoTasks(then: () => void) {
    const channel = new MessageChannel();
    let hops = 0;
    channel.port1.onmessage = () => {
      hops += 1;
      if (hops < 2) channel.port2.postMessage(0);
      else then();
    };
    channel.port2.postMessage(0);
  }

  /** Resolve with the clock just after the first frame in which `condition` holds. */
  function frameWhen(condition: Condition): Promise<{ end: number; endedOn: string }> {
    return new Promise((resolve) => {
      let gateSince: number | null = null;
      const tick = (now: number) => {
        const hit = check(condition);
        if (hit === 'unlock-gate') {
          gateSince ??= now;
          if (now - gateSince < UNLOCK_GATE_HOLD_MS) {
            requestAnimationFrame(tick);
            return;
          }
        } else {
          gateSince = null;
        }
        if (!hit) {
          requestAnimationFrame(tick);
          return;
        }
        afterTwoTasks(() => resolve({ end: performance.now(), endedOn: hit }));
      };
      requestAnimationFrame(tick);
    });
  }

  function summarise(start: number, end: number) {
    // The observer's callback runs later, as its own task. Take what it holds now.
    if (observer) record(observer.takeRecords());
    // Clip each task to the window, so one that only overlaps it counts only its overlap.
    const inside = longTasks
      .filter((t) => t.start + t.duration > start && t.start < end)
      .map((t) => Math.min(t.start + t.duration, end) - Math.max(t.start, start));
    return {
      longTasks: inside.length,
      tbtMs: inside.reduce((sum, d) => sum + Math.max(0, d - 50), 0),
      longestTaskMs: inside.reduce((max, d) => Math.max(max, d), 0),
    };
  }

  let armed: Promise<Span> | null = null;
  // Started here, not on request, so an early paint cannot be missed.
  const boot =
    location.pathname === '/demo' || options.bootLibrary
      ? frameWhen('library').then(({ end, endedOn }) => ({ end, endedOn }))
      : null;
  const typing: number[] = [];
  let typingOn = false;

  window.addEventListener(
    'keydown',
    (event) => {
      if (!typingOn) return;
      const start = event.timeStamp;
      requestAnimationFrame(() => afterTwoTasks(() => typing.push(performance.now() - start)));
    },
    true
  );

  w.__perf = {
    /** Navigation start (0) to the first frame showing `condition`. */
    fromNavigation(condition: Condition) {
      const ready = condition === 'library' && boot ? boot : frameWhen(condition);
      return ready.then(({ end, endedOn }) => ({ ms: end, endedOn, ...summarise(0, end) }));
    },
    /** The next pointerdown to the first frame showing `condition`. Call, then click. */
    arm(condition: Condition) {
      armed = new Promise((resolve) => {
        window.addEventListener(
          'pointerdown',
          (event) => {
            const start = event.timeStamp;
            let done = false;
            let last = start;
            let maxGap = 0;
            const gap = (now: number) => {
              if (done) return;
              maxGap = Math.max(maxGap, now - last);
              last = now;
              requestAnimationFrame(gap);
            };
            requestAnimationFrame(gap);
            void frameWhen(condition).then(({ end, endedOn }) => {
              done = true;
              maxGap = Math.max(maxGap, end - last);
              resolve({ ms: end - start, endedOn, maxFrameGapMs: maxGap, ...summarise(start, end) });
            });
          },
          { capture: true, once: true }
        );
      });
    },
    armed() {
      return armed;
    },
    startTyping() {
      typing.length = 0;
      typingOn = true;
      return performance.now();
    },
    stopTyping(start: number) {
      typingOn = false;
      return { latencies: typing.slice(), ...summarise(start, performance.now()) };
    },
    /** Long tasks between navigation start and now. */
    sinceNavigation() {
      return summarise(0, performance.now());
    },
    /** The app's `yidhan:library-load` measures (useNotesSync), oldest first. */
    libraryLoads() {
      return performance.getEntriesByName('yidhan:library-load').map((e) => ({ start: e.startTime, ms: e.duration }));
    },
    fcp() {
      const entry = performance.getEntriesByName('first-contentful-paint')[0];
      return entry ? entry.startTime : null;
    },
  };
}

/** A throttled page with the probe installed. One fresh context per sample. */
export async function throttledPage(
  context: BrowserContext,
  options: { bootLibrary?: boolean } = {}
): Promise<Page> {
  await context.addInitScript(probe, options);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  return page;
}

type PerfApi = {
  fromNavigation(c: Condition): Promise<Span>;
  arm(c: Condition): void;
  armed(): Promise<Span> | null;
  startTyping(): number;
  stopTyping(start: number): { latencies: number[]; longTasks: number; tbtMs: number; longestTaskMs: number };
  sinceNavigation(): { longTasks: number; tbtMs: number; longestTaskMs: number };
  libraryLoads(): { start: number; ms: number }[];
  fcp(): number | null;
};

/** Node-side handles on the page's `__perf` object. */
export function perf(page: Page) {
  return {
    fromNavigation: (c: Condition) =>
      page.evaluate((c) => (window as unknown as { __perf: PerfApi }).__perf.fromNavigation(c), c),
    arm: (c: Condition) => page.evaluate((c) => (window as unknown as { __perf: PerfApi }).__perf.arm(c), c),
    armed: () => page.evaluate(() => (window as unknown as { __perf: PerfApi }).__perf.armed()),
    startTyping: () => page.evaluate(() => (window as unknown as { __perf: PerfApi }).__perf.startTyping()),
    stopTyping: (start: number) =>
      page.evaluate((s) => (window as unknown as { __perf: PerfApi }).__perf.stopTyping(s), start),
    sinceNavigation: () => page.evaluate(() => (window as unknown as { __perf: PerfApi }).__perf.sinceNavigation()),
    libraryLoads: () => page.evaluate(() => (window as unknown as { __perf: PerfApi }).__perf.libraryLoads()),
    fcp: () => page.evaluate(() => (window as unknown as { __perf: PerfApi }).__perf.fcp()),
  };
}

/** Time from the next click to `condition`. */
export async function timeClick(page: Page, condition: Condition, click: () => Promise<void>): Promise<Span> {
  await perf(page).arm(condition);
  await click();
  const span = await perf(page).armed();
  if (!span) throw new Error('The probe was not armed');
  return span;
}

// ---------------------------------------------------------------------------
// Arithmetic and output
// ---------------------------------------------------------------------------

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const median = (values: number[]) => quantile(values, 0.5);

export interface Metric {
  /** Median across samples. */
  median: number;
  samples: number[];
  unit: 'ms' | 'count';
}

export function metric(samples: number[], unit: Metric['unit'] = 'ms'): Metric {
  const round = (n: number) => Math.round(n * 10) / 10;
  return { median: round(median(samples)), samples: samples.map(round), unit };
}

export type Results = Record<string, Metric>;

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** Print a table and write `perf-results/<stamp>.json` and `perf-results/latest.json`. */
export function writeResults(results: Results, notes: string[], browserVersion: string): string {
  const names = Object.keys(results);
  if (names.length === 0) return '';

  const width = Math.max(...names.map((n) => n.length));
  const lines = [
    `Timing harness — CPU ${CPU_THROTTLE}x, ${SAMPLES} samples, median shown`,
    `${'metric'.padEnd(width)}  ${'median'.padStart(9)}  samples`,
    ...names.map((name) => {
      const m = results[name];
      const value = `${m.median}${m.unit === 'ms' ? ' ms' : ''}`;
      return `${name.padEnd(width)}  ${value.padStart(9)}  ${m.samples.join(', ')}`;
    }),
    ...notes.map((n) => `note: ${n}`),
  ];
  console.log(`\n${lines.join('\n')}\n`);

  const outDir = path.join(repoRoot, 'perf-results');
  mkdirSync(outDir, { recursive: true });
  const report = {
    createdAt: new Date().toISOString(),
    commit: git(['rev-parse', '--short', 'HEAD']),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: git(['status', '--porcelain']) !== '',
    machine: {
      platform: `${os.platform()} ${os.release()}`,
      cpu: os.cpus()[0]?.model ?? 'unknown',
      cores: os.cpus().length,
      ci: Boolean(process.env.CI),
    },
    browser: browserVersion,
    cpuThrottle: CPU_THROTTLE,
    samples: SAMPLES,
    notes,
    metrics: results,
  };
  const stamp = report.createdAt.replace(/[:.]/g, '-');
  const file = path.join(outDir, `${stamp}-${report.commit}.json`);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(file, json);
  writeFileSync(path.join(outDir, 'latest.json'), json);
  console.log(`Wrote ${path.relative(repoRoot, file)}`);
  return file;
}
