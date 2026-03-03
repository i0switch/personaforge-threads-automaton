import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('webhook-reply-check: delegating to check-replies (single processing path)');

    const delegated = await supabase.functions.invoke('check-replies', {
      body: { source: 'webhook-reply-check' }
    });

    if (delegated.error) {
      console.error('Failed to delegate to check-replies:', delegated.error);
      return new Response(JSON.stringify({
        success: false,
        delegated: true,
        error: delegated.error.message || String(delegated.error)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    return new Response(JSON.stringify({
      success: true,
      delegated: true,
      message: 'Delegated to check-replies to avoid duplicate reply processing',
      result: delegated.data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('webhook-reply-check delegation error:', error);
    return new Response(JSON.stringify({
      success: false,
      delegated: true,
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
