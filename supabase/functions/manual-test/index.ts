import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔥 MANUAL TEST FUNCTION CALLED');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Time:', new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('✅ Supabase client created');

    // 未処理リプライを1件取得
    const { data: replies, error } = await supabase
      .from('thread_replies')
      .select('*, personas(name)')
      .eq('reply_status', 'pending')
      .limit(1);

    console.log('📝 Found replies:', replies?.length || 0);
    console.log('❌ Error:', error);

    if (replies && replies.length > 0) {
      console.log('🎯 First reply:', replies[0].reply_text);
      console.log('👤 Persona:', replies[0].personas?.name);
    }

    return new Response(JSON.stringify({ 
      success: true,
      timestamp: new Date().toISOString(),
      repliesFound: replies?.length || 0,
      testData: replies?.[0] || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('💥 Test function error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});