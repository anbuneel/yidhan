import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime } from './formatTime';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock current time to 2024-01-15 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for times less than a minute ago', () => {
    const date = new Date('2024-01-15T11:59:30');
    expect(formatRelativeTime(date)).toBe('Just now');
  });

  it('returns "1 minute ago" for exactly 1 minute ago', () => {
    const date = new Date('2024-01-15T11:59:00');
    expect(formatRelativeTime(date)).toBe('1 minute ago');
  });

  it('returns "X minutes ago" for times less than an hour ago', () => {
    const date = new Date('2024-01-15T11:30:00');
    expect(formatRelativeTime(date)).toBe('30 minutes ago');
  });

  it('returns "1 hour ago" for exactly 1 hour ago', () => {
    const date = new Date('2024-01-15T11:00:00');
    expect(formatRelativeTime(date)).toBe('1 hour ago');
  });

  it('returns "X hours ago" for times less than a day ago', () => {
    const date = new Date('2024-01-15T06:00:00');
    expect(formatRelativeTime(date)).toBe('6 hours ago');
  });

  it('returns "Yesterday" for exactly 1 day ago', () => {
    const date = new Date('2024-01-14T12:00:00');
    expect(formatRelativeTime(date)).toBe('Yesterday');
  });

  it('returns "X days ago" for times less than a week ago', () => {
    const date = new Date('2024-01-12T12:00:00');
    expect(formatRelativeTime(date)).toBe('3 days ago');
  });

  it('returns "1 week ago" for exactly 1 week ago', () => {
    const date = new Date('2024-01-08T12:00:00');
    expect(formatRelativeTime(date)).toBe('1 week ago');
  });

  it('returns "X weeks ago" for times less than a month ago', () => {
    const date = new Date('2024-01-01T12:00:00');
    expect(formatRelativeTime(date)).toBe('2 weeks ago');
  });

  it('returns "1 month ago" for around 30 days ago', () => {
    const date = new Date('2023-12-16T12:00:00');
    expect(formatRelativeTime(date)).toBe('1 month ago');
  });

  it('returns "X months ago" for times less than a year ago', () => {
    const date = new Date('2023-10-15T12:00:00');
    expect(formatRelativeTime(date)).toBe('3 months ago');
  });

  it('returns formatted date for times over a year ago', () => {
    const date = new Date('2022-01-15T12:00:00');
    const result = formatRelativeTime(date);
    // The exact format depends on locale, but it should be a date string
    expect(result).toMatch(/\d/);
    expect(result).not.toContain('ago');
  });
});
