import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-account-deletion-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AccountDeletionRequest = {
  user_id: string;
  requested_at: string;
  release_at: string;
  status: string;
  cancelled_at: string | null;
  attempt_count: number;
  processing_worker_id: string | null;
};

type SupabaseServiceClient = ReturnType<typeof createClient>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function audit(
  client: SupabaseServiceClient,
  request: AccountDeletionRequest,
  outcome: string,
  detail: string | null,
  workerId: string
) {
  const { error } = await client.from('account_deletion_audit').insert({
    user_id: request.user_id,
    requested_at: request.requested_at,
    release_at: request.release_at,
    attempt_count: request.attempt_count,
    outcome,
    detail,
    worker_id: workerId,
  });

  if (error) {
    console.error('Failed to write account deletion audit row', { outcome, error });
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function markFailed(
  client: SupabaseServiceClient,
  request: AccountDeletionRequest,
  detail: string,
  workerId: string
) {
  const sanitized = detail.slice(0, 1000);
  const { error } = await client.rpc('mark_account_deletion_failed', {
    target_user_id: request.user_id,
    failure_detail: sanitized,
  });

  if (error) {
    console.error('Failed to mark account deletion failed', error);
  }

  await audit(client, request, 'failed', sanitized, workerId);
}

async function fetchRequest(client: SupabaseServiceClient, userId: string) {
  return await client
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
}

async function processRequest(
  client: SupabaseServiceClient,
  request: AccountDeletionRequest,
  workerId: string
) {
  await audit(client, request, 'processing_started', null, workerId);

  try {
    const { data: beforeDelete, error: beforeDeleteError } = await fetchRequest(client, request.user_id);
    if (beforeDeleteError) throw beforeDeleteError;

    if (!beforeDelete || beforeDelete.cancelled_at || beforeDelete.status === 'cancelled') {
      await client.rpc('mark_account_deletion_skipped_cancelled', { target_user_id: request.user_id });
      await audit(client, request, 'skipped_cancelled', 'Request was cancelled before deletion.', workerId);
      return { userId: request.user_id, outcome: 'skipped_cancelled' };
    }

    const { error: appDeleteError } = await client.rpc('delete_account_app_data', {
      target_user_id: request.user_id,
    });
    if (appDeleteError) throw appDeleteError;

    const { data: afterAppDelete, error: afterAppDeleteError } = await fetchRequest(client, request.user_id);
    if (afterAppDeleteError) throw afterAppDeleteError;

    if (!afterAppDelete || afterAppDelete.cancelled_at || afterAppDelete.status === 'cancelled') {
      await client.rpc('mark_account_deletion_skipped_cancelled', { target_user_id: request.user_id });
      await audit(client, request, 'skipped_cancelled', 'Request was cancelled before auth user deletion.', workerId);
      return { userId: request.user_id, outcome: 'skipped_cancelled' };
    }

    const { error: authDeleteError } = await client.auth.admin.deleteUser(request.user_id);
    if (authDeleteError) throw authDeleteError;

    await audit(client, request, 'released', 'App data and auth user deleted.', workerId);
    return { userId: request.user_id, outcome: 'released' };
  } catch (error) {
    const detail = errorMessage(error);
    await markFailed(client, request, detail, workerId);
    return { userId: request.user_id, outcome: 'failed', error: detail };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const configuredSecret = getEnv('PROCESS_ACCOUNT_DELETIONS_SECRET');
    const suppliedSecret = req.headers.get('x-account-deletion-secret');

    if (!suppliedSecret || suppliedSecret !== configuredSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const workerId = crypto.randomUUID();
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: claimed, error: claimError } = await client.rpc('claim_due_account_deletions', {
      batch_limit: 10,
      worker_id: workerId,
    });

    if (claimError) {
      console.error('Failed to claim due account deletions', claimError);
      return jsonResponse({ error: 'Could not claim due deletions' }, 500);
    }

    const results = [];
    for (const request of (claimed ?? []) as AccountDeletionRequest[]) {
      results.push(await processRequest(client, request, workerId));
    }

    return jsonResponse({
      workerId,
      claimed: claimed?.length ?? 0,
      results,
    });
  } catch (error) {
    console.error('process-account-deletions failed', error);
    return jsonResponse({ error: 'Unexpected account deletion worker failure' }, 500);
  }
});
