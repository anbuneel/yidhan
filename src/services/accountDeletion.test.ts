import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cancelAccountDeletion,
  confirmAccountDeletionWithPassword,
  fetchAccountDeletionRequest,
  isActiveAccountDeletionRequest,
  requestAccountDeletion,
} from './accountDeletion';
import type { DbAccountDeletionRequest } from '../types/database';

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
}));

const requestRow: DbAccountDeletionRequest = {
  user_id: 'user-123',
  requested_at: '2026-06-21T00:00:00.000Z',
  release_at: '2026-07-05T00:00:00.000Z',
  cancelled_at: null,
  status: 'pending',
  attempt_count: 0,
  last_attempt_at: null,
  next_attempt_at: null,
  processing_started_at: null,
  processing_worker_id: null,
  released_at: null,
  error: null,
  created_at: '2026-06-21T00:00:00.000Z',
  updated_at: '2026-06-21T00:00:00.000Z',
};

describe('accountDeletion service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the caller account deletion request through RLS-scoped select', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: requestRow, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    mockSupabase.from.mockReturnValue({ select });

    const result = await fetchAccountDeletionRequest();

    expect(mockSupabase.from).toHaveBeenCalledWith('account_deletion_requests');
    expect(select).toHaveBeenCalledWith('*');
    expect(result).toEqual({ request: requestRow, error: null });
  });

  it('requests account deletion only through the confirmation-token RPC', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: requestRow, error: null });

    const result = await requestAccountDeletion('confirmation-token');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('request_account_deletion', {
      confirmation_token: 'confirmation-token',
    });
    expect(result).toEqual({ request: requestRow, error: null });
  });

  it('cancels account deletion only through the cancel RPC', async () => {
    const cancelledRequest = {
      ...requestRow,
      status: 'cancelled',
      cancelled_at: '2026-06-21T01:00:00.000Z',
    } satisfies DbAccountDeletionRequest;
    mockSupabase.rpc.mockResolvedValue({ data: cancelledRequest, error: null });

    const result = await cancelAccountDeletion();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_account_deletion');
    expect(result).toEqual({ request: cancelledRequest, error: null });
  });

  it('mints account deletion confirmation through the Edge Function', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: {
        confirmationToken: 'confirmation-token',
        expiresAt: '2026-06-21T00:10:00.000Z',
      },
      error: null,
    });

    const result = await confirmAccountDeletionWithPassword('password');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('confirm-sensitive-action', {
      body: {
        action: 'account_deletion',
        password: 'password',
      },
    });
    expect(result).toEqual({
      confirmationToken: 'confirmation-token',
      expiresAt: '2026-06-21T00:10:00.000Z',
      error: null,
    });
  });

  it('treats pending, processing, and failed uncancelled requests as active', () => {
    expect(isActiveAccountDeletionRequest(requestRow)).toBe(true);
    expect(isActiveAccountDeletionRequest({ ...requestRow, status: 'processing' })).toBe(true);
    expect(isActiveAccountDeletionRequest({ ...requestRow, status: 'failed' })).toBe(true);
    expect(isActiveAccountDeletionRequest({ ...requestRow, status: 'cancelled', cancelled_at: 'now' })).toBe(false);
    expect(isActiveAccountDeletionRequest(null)).toBe(false);
  });
});
