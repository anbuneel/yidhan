import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ConfirmRequest = {
  action?: string;
  method?: 'password' | 'email_otp_start' | 'email_otp_verify';
  password?: string;
  otp?: string;
};

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

function base64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function mintConfirmation(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  method: 'password' | 'email_otp'
) {
  const confirmationToken = randomToken();
  const tokenHash = await sha256Hex(confirmationToken);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await serviceClient
    .from('sensitive_action_confirmations')
    .insert({
      user_id: userId,
      action: 'account_deletion',
      token_hash: tokenHash,
      method,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('Failed to store sensitive action confirmation', insertError);
    return { confirmationToken: null, expiresAt: null, error: insertError };
  }

  return { confirmationToken, expiresAt, error: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = getEnv('SUPABASE_ANON_KEY');

    const authorization = req.headers.get('Authorization');
    const accessToken = authorization?.replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const body = (await req.json()) as ConfirmRequest;
    if (body.action !== 'account_deletion') {
      return jsonResponse({ error: 'Unsupported sensitive action' }, 400);
    }
    const method = body.method ?? 'password';

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await serviceClient.auth.getUser(accessToken);
    if (userError || !userData.user?.email) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (method === 'email_otp_start') {
      const { error: otpError } = await authClient.auth.signInWithOtp({
        email: userData.user.email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        console.error('Failed to start account deletion email OTP', otpError);
        return jsonResponse({ error: 'Could not send verification code' }, 500);
      }

      return jsonResponse({ otpSent: true });
    }

    if (method === 'email_otp_verify') {
      if (!body.otp) {
        return jsonResponse({ error: 'Verification code is required' }, 400);
      }

      const { data: verifiedData, error: verifyError } = await authClient.auth.verifyOtp({
        email: userData.user.email,
        token: body.otp,
        type: 'email',
      });

      if (verifyError || verifiedData.user?.id !== userData.user.id) {
        return jsonResponse({ error: 'Verification failed' }, 401);
      }

      const confirmation = await mintConfirmation(serviceClient, userData.user.id, 'email_otp');
      if (confirmation.error || !confirmation.confirmationToken || !confirmation.expiresAt) {
        return jsonResponse({ error: 'Could not create confirmation' }, 500);
      }

      return jsonResponse({
        confirmationToken: confirmation.confirmationToken,
        expiresAt: confirmation.expiresAt,
      });
    }

    if (!body.password) {
      return jsonResponse({ error: 'Password is required' }, 400);
    }

    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email: userData.user.email,
      password: body.password,
    });

    if (signInError || signInData.user?.id !== userData.user.id) {
      return jsonResponse({ error: 'Verification failed' }, 401);
    }

    const confirmation = await mintConfirmation(serviceClient, userData.user.id, 'password');
    if (confirmation.error || !confirmation.confirmationToken || !confirmation.expiresAt) {
      return jsonResponse({ error: 'Could not create confirmation' }, 500);
    }

    return jsonResponse({
      confirmationToken: confirmation.confirmationToken,
      expiresAt: confirmation.expiresAt,
    });
  } catch (error) {
    console.error('confirm-sensitive-action failed', error);
    return jsonResponse({ error: 'Unexpected confirmation failure' }, 500);
  }
});
