import { supabase } from '../lib/supabase';
import type { DbAccountDeletionRequest } from '../types/database';

type AccountDeletionServiceResult = {
  request: DbAccountDeletionRequest | null;
  error: Error | null;
};

type ConfirmationResponse = {
  confirmationToken: string;
  expiresAt: string;
};

type ConfirmationResult = {
  confirmationToken: string | null;
  expiresAt: string | null;
  error: Error | null;
};

const ACTIVE_ACCOUNT_DELETION_STATUSES = new Set<DbAccountDeletionRequest['status']>([
  'pending',
  'processing',
  'failed',
]);

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    return new Error(message || fallback);
  }
  return new Error(fallback);
}

export function isActiveAccountDeletionRequest(
  request: DbAccountDeletionRequest | null
): request is DbAccountDeletionRequest {
  return Boolean(
    request &&
    request.cancelled_at === null &&
    ACTIVE_ACCOUNT_DELETION_STATUSES.has(request.status)
  );
}

export async function fetchAccountDeletionRequest(): Promise<AccountDeletionServiceResult> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .maybeSingle();

  if (error) {
    return { request: null, error: toError(error, 'Could not load account deletion status') };
  }

  return { request: data, error: null };
}

export async function requestAccountDeletion(
  confirmationToken: string
): Promise<AccountDeletionServiceResult> {
  const { data, error } = await supabase.rpc('request_account_deletion', {
    confirmation_token: confirmationToken,
  });

  if (error) {
    return { request: null, error: toError(error, 'Could not request account deletion') };
  }

  return { request: data, error: null };
}

export async function cancelAccountDeletion(): Promise<AccountDeletionServiceResult> {
  const { data, error } = await supabase.rpc('cancel_account_deletion');

  if (error) {
    return { request: null, error: toError(error, 'Could not cancel account deletion') };
  }

  return { request: data, error: null };
}

export async function confirmAccountDeletionWithPassword(
  password: string
): Promise<ConfirmationResult> {
  const { data, error } = await supabase.functions.invoke<ConfirmationResponse>(
    'confirm-sensitive-action',
    {
      body: {
        action: 'account_deletion',
        password,
      },
    }
  );

  if (error) {
    return {
      confirmationToken: null,
      expiresAt: null,
      error: toError(error, 'Could not confirm account deletion'),
    };
  }

  if (!data?.confirmationToken || !data.expiresAt) {
    return {
      confirmationToken: null,
      expiresAt: null,
      error: new Error('Could not confirm account deletion'),
    };
  }

  return {
    confirmationToken: data.confirmationToken,
    expiresAt: data.expiresAt,
    error: null,
  };
}
