import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

type CorsHeaders = Record<string, string>;

function jsonResponse(body: Record<string, unknown>, status: number, corsHeaders: CorsHeaders): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function requireInternalRequest(req: Request, corsHeaders: CorsHeaders): { ok: true } | { ok: false; response: Response } {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedCronSecret = req.headers.get('x-cron-secret');

  if (cronSecret && providedCronSecret && providedCronSecret === cronSecret) {
    return { ok: true };
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;
  const apiKey = req.headers.get('apikey');

  if (serviceRoleKey && (bearer === serviceRoleKey || apiKey === serviceRoleKey)) {
    return { ok: true };
  }

  return {
    ok: false,
    response: jsonResponse(
      { success: false, error: 'Unauthorized: internal authentication required' },
      401,
      corsHeaders,
    ),
  };
}

export async function requireAuthenticatedUser(
  req: Request,
  corsHeaders: CorsHeaders,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      response: jsonResponse({ success: false, error: 'Unauthorized: bearer token required' }, 401, corsHeaders),
    };
  }

  const bearer = authHeader.slice('Bearer '.length).trim();
  if (!bearer) {
    return {
      ok: false,
      response: jsonResponse({ success: false, error: 'Unauthorized: empty bearer token' }, 401, corsHeaders),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAuthKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAuthKey) {
    return {
      ok: false,
      response: jsonResponse({ success: false, error: 'Server auth configuration error' }, 500, corsHeaders),
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAuthKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data, error } = await authClient.auth.getUser(bearer);
  if (error || !data.user) {
    return {
      ok: false,
      response: jsonResponse({ success: false, error: 'Unauthorized: invalid token' }, 401, corsHeaders),
    };
  }

  return { ok: true, userId: data.user.id };
}