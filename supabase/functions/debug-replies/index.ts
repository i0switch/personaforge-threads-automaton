import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== デバッグ関数開始 ===');
    
    // 未処理のリプライを確認
    const { data: pendingReplies, error: repliesError } = await supabase
      .from('thread_replies')
      .select('*, personas(name, threads_access_token)')
      .eq('reply_status', 'pending')
      .limit(3);

    console.log('未処理リプライ数:', pendingReplies?.length || 0);
    
    if (pendingReplies && pendingReplies.length > 0) {
      for (const reply of pendingReplies) {
        console.log(`リプライ: ${reply.reply_text}, ペルソナ: ${reply.personas?.name}`);
        console.log(`アクセストークンあり: ${reply.personas?.threads_access_token ? 'はい' : 'いいえ'}`);
        
        // 定型文返信設定を確認
        const { data: autoReplies } = await supabase
          .from('auto_replies')
          .select('*')
          .eq('user_id', reply.user_id)
          .eq('is_active', true);
          
        console.log(`定型文設定数: ${autoReplies?.length || 0}`);
        if (autoReplies) {
          autoReplies.forEach(ar => {
            console.log(`キーワード: [${ar.trigger_keywords?.join(', ')}] → "${ar.response_template}"`);
            
            // マッチングテスト
            const replyText = reply.reply_text.toLowerCase().trim();
            for (const keyword of ar.trigger_keywords || []) {
              const keywordLower = keyword.toLowerCase().trim();
              const isMatch = replyText.includes(keywordLower) || 
                             replyText.includes(keyword) || 
                             keyword === replyText.trim();
              console.log(`"${reply.reply_text}" と "${keyword}" のマッチ: ${isMatch}`);
            }
          });
        }
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      pendingReplies: pendingReplies?.length || 0,
      details: pendingReplies?.map(r => ({
        text: r.reply_text,
        persona: r.personas?.name,
        hasToken: !!r.personas?.threads_access_token
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('デバッグエラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});