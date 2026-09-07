import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('../lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...(args as [])) },
}));

import {
  REQUIRED_SCHEMA_VERSION,
  blocksWrites,
  checkSchemaCompatibility,
  evaluateSchemaCompatibility,
} from './schemaVersion';

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  setOnline(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('evaluateSchemaCompatibility', () => {
  it('allows writes when the database is at the required level', () => {
    expect(evaluateSchemaCompatibility(3, 3)).toEqual({ status: 'ok', appliedVersion: 3 });
  });

  it('allows writes when the database is ahead of the client', () => {
    // A database migrated before the client rolls out is the normal deploy order.
    expect(evaluateSchemaCompatibility(4, 3)).toEqual({ status: 'ok', appliedVersion: 4 });
  });

  it('refuses writes when the client is ahead of the database', () => {
    expect(evaluateSchemaCompatibility(2, 3)).toEqual({
      status: 'database-behind',
      appliedVersion: 2,
      requiredVersion: 3,
    });
  });

  it('defaults to the version this build requires', () => {
    expect(evaluateSchemaCompatibility(REQUIRED_SCHEMA_VERSION).status).toBe('ok');
    expect(evaluateSchemaCompatibility(REQUIRED_SCHEMA_VERSION - 1).status).toBe(
      'database-behind'
    );
  });
});

describe('blocksWrites', () => {
  it('blocks only on a definite mismatch', () => {
    expect(blocksWrites({ status: 'database-behind', appliedVersion: 1, requiredVersion: 2 })).toBe(
      true
    );
    expect(blocksWrites({ status: 'ok', appliedVersion: 2 })).toBe(false);
    expect(blocksWrites({ status: 'unknown', reason: 'offline' })).toBe(false);
    expect(blocksWrites({ status: 'unknown', reason: 'unreachable' })).toBe(false);
    expect(blocksWrites({ status: 'unknown', reason: 'not-provisioned' })).toBe(false);
  });
});

describe('checkSchemaCompatibility', () => {
  it('reads the applied version and compares it', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { version: 5 }, error: null });

    await expect(checkSchemaCompatibility(5)).resolves.toEqual({
      status: 'ok',
      appliedVersion: 5,
    });
    expect(mockFrom).toHaveBeenCalledWith('schema_version');
  });

  it('reports a database behind the client', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { version: 1 }, error: null });

    await expect(checkSchemaCompatibility(2)).resolves.toEqual({
      status: 'database-behind',
      appliedVersion: 1,
      requiredVersion: 2,
    });
  });

  it('does not even ask when the device is offline', async () => {
    setOnline(false);

    await expect(checkSchemaCompatibility(2)).resolves.toEqual({
      status: 'unknown',
      reason: 'offline',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('fails open when the query errors', async () => {
    // A reader on a bad connection must not be locked out of their own notes.
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });

    await expect(checkSchemaCompatibility(2)).resolves.toEqual({
      status: 'unknown',
      reason: 'unreachable',
    });
  });

  it('fails open when the call throws', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('network down'));

    await expect(checkSchemaCompatibility(2)).resolves.toEqual({
      status: 'unknown',
      reason: 'unreachable',
    });
  });

  it('treats a missing table as version 0, which is a real answer', async () => {
    // The table is itself a migration: a database without it has not had this one
    // applied, and that is a mismatch rather than an unreachable server.
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation "schema_version" does not exist' },
    });

    await expect(checkSchemaCompatibility(1)).resolves.toEqual({
      status: 'database-behind',
      appliedVersion: 0,
      requiredVersion: 1,
    });
  });

  it('recognises PostgREST reporting the table through its message', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Could not find the table 'public.schema_version' in the schema cache" },
    });

    await expect(checkSchemaCompatibility(1)).resolves.toMatchObject({
      status: 'database-behind',
      appliedVersion: 0,
    });
  });

  it('does not block a build that requires nothing, even with no table', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation "schema_version" does not exist' },
    });

    await expect(checkSchemaCompatibility(0)).resolves.toEqual({
      status: 'ok',
      appliedVersion: 0,
    });
  });

  it('fails open when the table exists but was never seeded', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(checkSchemaCompatibility(2)).resolves.toEqual({
      status: 'unknown',
      reason: 'not-provisioned',
    });
  });

  it('fails open when the row carries a non-numeric version', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { version: 'one' }, error: null });

    await expect(checkSchemaCompatibility(2)).resolves.toEqual({
      status: 'unknown',
      reason: 'not-provisioned',
    });
  });
});
