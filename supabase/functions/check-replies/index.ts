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

  console.log('🚀 CHECK-REPLIES FUNCTION STARTED');
  console.log('Time:', new Date().toISOString());

  try {
    // 未処理のリプライを取得
    const { data: pendingReplies, error: repliesError } = await supabase
      .from('thread_replies')
      .select(`
        *,
        personas (
          id,
          name,
          user_id,
          auto_reply_enabled,
          ai_auto_reply_enabled,
          threads_access_token,
          personality,
          tone_of_voice,
          expertise
        )
      `)
      .eq('reply_status', 'pending')
      .limit(10);

    console.log(`📝 未処理リプライ数: ${pendingReplies?.length || 0}`);

    if (repliesError) {
      console.error('❌ リプライ取得エラー:', repliesError);
      throw repliesError;
    }

    if (!pendingReplies || pendingReplies.length === 0) {
      console.log('✅ 処理すべきリプライがありません');
      return new Response(JSON.stringify({ 
        success: true,
        repliesFound: 0,
        message: 'No replies to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let processedCount = 0;

    // 各リプライを処理
    for (const reply of pendingReplies) {
      console.log(`\n🔍 処理中: "${reply.reply_text}" (ID: ${reply.reply_id})`);
      console.log(`📋 ペルソナ: ${reply.personas?.name || 'Unknown'}`);
      
      // ペルソナの自動返信設定をチェック
      if (!reply.personas?.auto_reply_enabled && !reply.personas?.ai_auto_reply_enabled) {
        console.log('⚠️ 自動返信設定がOFFです - スキップ');
        continue;
      }
      
      if (!reply.personas?.threads_access_token) {
        console.log('⚠️ アクセストークンがありません - スキップ');
        continue;
      }

      // 定型文による自動返信がONの場合のみ処理
      let templateMatched = false;
      
      if (reply.personas?.auto_reply_enabled) {
        // このペルソナの定型文返信設定を取得
        const { data: autoReplies, error: autoReplyError } = await supabase
          .from('auto_replies')
          .select('*')
          .eq('user_id', reply.personas.user_id)
          .eq('is_active', true);

        if (autoReplyError) {
          console.error('❌ 定型文返信設定の取得エラー:', autoReplyError);
        } else if (autoReplies && autoReplies.length > 0) {
          console.log(`🎯 定型文返信設定: ${autoReplies.length}件`);

          // キーワードマッチングをチェック
          const replyText = (reply.reply_text || '').toLowerCase().trim();

          for (const autoReply of autoReplies) {
            const keywords = autoReply.trigger_keywords || [];
        
            for (const keyword of keywords) {
              if (!keyword) continue;
          
              const keywordLower = keyword.toLowerCase().trim();
              
              // より確実な部分一致チェック
              const cleanReplyText = replyText.replace(/[「」『』\(\)（）\[\]【】<>《》]/g, '').trim();
              const cleanKeyword = keywordLower.replace(/[「」『』\(\)（）\[\]【】<>《》]/g, '').trim();
              
              const isMatch = cleanReplyText.includes(cleanKeyword) || 
                             replyText.includes(keywordLower) ||
                             cleanReplyText === cleanKeyword ||
                             replyText === keywordLower;

              console.log(`🔍 キーワード "${keyword}" vs "${reply.reply_text}" → ${isMatch}`);
              console.log(`🔍 クリーンテキスト: "${cleanReplyText}" vs "${cleanKeyword}"`);

              if (isMatch) {
                console.log(`🎯 マッチしました！返信: "${autoReply.response_template}"`);
                
                try {
                  // Threads APIで返信を送信
                  await sendThreadsReply(reply.personas, reply, autoReply.response_template);
                  
                  // ステータスを更新
                  await supabase
                    .from('thread_replies')
                    .update({
                      reply_status: 'sent',
                      auto_reply_sent: true,
                      updated_at: new Date().toISOString()
                    })
                    .eq('reply_id', reply.reply_id);

                  console.log('✅ 定型文返信送信完了');
                  processedCount++;
                  templateMatched = true;
                  break;
              
                } catch (sendError) {
                  console.error('❌ 定型文返信送信エラー:', sendError);
                  
                  // エラー状態を記録
                  await supabase
                    .from('thread_replies')
                    .update({
                      reply_status: 'failed',
                      updated_at: new Date().toISOString()
                    })
                    .eq('reply_id', reply.reply_id);
                }
              }
            }
            
            if (templateMatched) break;
          }
        } else {
          console.log('📝 定型文返信設定がありません');
        }
      }

      // 定型文でマッチしなかった場合、AI自動返信を試す
      if (!templateMatched && reply.personas?.ai_auto_reply_enabled) {
        console.log('🤖 AI自動返信を実行します');
        
        try {
          // generate-auto-replyエッジ関数を呼び出し
          const aiResponse = await supabase.functions.invoke('generate-auto-reply', {
            body: {
              persona_id: reply.persona_id,
              reply_text: reply.reply_text,
              original_post_id: reply.original_post_id
            }
          });

          if (aiResponse.error) {
            throw new Error(aiResponse.error.message);
          }

          const aiReplyText = aiResponse.data?.generatedReply;
          
          if (aiReplyText) {
            // AI生成された返信を送信
            await sendThreadsReply(reply.personas, reply, aiReplyText);
            
            // ステータスを更新
            await supabase
              .from('thread_replies')
              .update({
                reply_status: 'sent',
                auto_reply_sent: true,
                updated_at: new Date().toISOString()
              })
              .eq('reply_id', reply.reply_id);

            console.log('✅ AI自動返信送信完了');
            processedCount++;
          }
          
        } catch (aiError) {
          console.error('❌ AI自動返信エラー:', aiError);
          
          // エラー状態を記録
          await supabase
            .from('thread_replies')
            .update({
              reply_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('reply_id', reply.reply_id);
        }
      }

      if (!templateMatched && !reply.personas?.ai_auto_reply_enabled) {
        console.log('❌ マッチするキーワードがなく、AI返信も無効です');
      }
    }

    console.log(`🏁 処理完了: ${processedCount}件の返信を送信`);

    return new Response(JSON.stringify({ 
      success: true,
      repliesFound: pendingReplies.length,
      processed: processedCount,
      message: 'Reply check completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('💥 エラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Threads APIで返信を送信する関数
async function sendThreadsReply(persona: any, thread: any, responseText: string) {
  console.log('📤 Threads返信送信開始...');
  
  // Step 1: Create the reply container
  const createResponse = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      media_type: 'TEXT',
      text: responseText,
      reply_to_id: thread.original_post_id,
      access_token: persona.threads_access_token
    })
  });

  const createResult = await createResponse.json();
  console.log('📝 コンテナ作成:', createResponse.status, createResult);

  if (!createResponse.ok) {
    throw new Error(`Container creation failed: ${createResponse.status} - ${JSON.stringify(createResult)}`);
  }

  const containerId = createResult.id;

  // Step 2: Publish the reply
  const publishResponse = await fetch(`https://graph.threads.net/v1.0/${containerId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      access_token: persona.threads_access_token
    })
  });

  const publishResult = await publishResponse.json();
  console.log('📢 返信公開:', publishResponse.status, publishResult);

  if (!publishResponse.ok) {
    throw new Error(`Publish failed: ${publishResponse.status} - ${JSON.stringify(publishResult)}`);
  }

  console.log('✅ 返信送信成功:', publishResult.id);
  return publishResult;
}