import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log(`🧪 修正機能テスト開始: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const testResults = {
      testTime: new Date().toISOString(),
      tests: []
    };

    console.log('📊 テスト1: トークン取得キー名統一テスト');
    
    // テスト1: トークン取得機能テスト
    const { data: testPersonas } = await supabase
      .from('personas')
      .select('id, name, threads_access_token')
      .not('threads_access_token', 'is', null)
      .limit(2);

    if (testPersonas && testPersonas.length > 0) {
      for (const persona of testPersonas) {
        try {
          // retrieve-secret関数をテスト（修正後のキー名）
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
            body: {
              key: `threads_access_token_${persona.id}`,
              fallback: persona.threads_access_token
            }
          });

          testResults.tests.push({
            test: 'Token Retrieval',
            persona: persona.name,
            success: !tokenError && tokenData?.secret,
            details: tokenError ? tokenError.message : 'Token retrieved successfully'
          });

          console.log(`✅ トークン取得テスト - ${persona.name}: ${!tokenError ? '成功' : '失敗'}`);
        } catch (error) {
          console.error(`❌ トークン取得エラー - ${persona.name}:`, error);
          testResults.tests.push({
            test: 'Token Retrieval',
            persona: persona.name,
            success: false,
            details: error.message
          });
        }
      }
    }

    console.log('📊 テスト2: AI自動返信レスポンス形式テスト');
    
    // テスト2: AI自動返信のレスポンス形式テスト
    try {
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('generate-auto-reply', {
        body: {
          postContent: 'こんにちは、テスト投稿です。',
          replyContent: 'はじめまして！',
          persona: {
            id: 'test-persona-id',
            name: 'テストペルソナ',
            user_id: 'test-user-id',
            age: '25',
            personality: 'フレンドリー',
            tone_of_voice: 'カジュアル',
            expertise: ['テスト']
          }
        }
      });

      const hasCorrectFormat = aiResponse && 
                              typeof aiResponse.success !== 'undefined' && 
                              typeof aiResponse.reply !== 'undefined';

      testResults.tests.push({
        test: 'AI Reply Response Format',
        success: hasCorrectFormat,
        details: hasCorrectFormat ? 'Correct format: {success, reply}' : 'Incorrect format or error',
        responseFormat: aiResponse ? Object.keys(aiResponse) : null,
        error: aiError?.message
      });

      console.log(`✅ AI返信形式テスト: ${hasCorrectFormat ? '成功' : '失敗'}`);
    } catch (error) {
      console.error('❌ AI返信形式テストエラー:', error);
      testResults.tests.push({
        test: 'AI Reply Response Format',
        success: false,
        details: error.message
      });
    }

    console.log('📊 テスト3: トリガー返信機能テスト');
    
    // テスト3: 実際の未返信リプライでトリガー返信テスト
    const { data: unsentReplies } = await supabase
      .from('thread_replies')
      .select(`
        id,
        reply_id,
        reply_text,
        persona_id,
        personas!inner(
          name,
          auto_reply_enabled,
          ai_auto_reply_enabled
        )
      `)
      .eq('auto_reply_sent', false)
      .eq('personas.auto_reply_enabled', true)
      .limit(1);

    if (unsentReplies && unsentReplies.length > 0) {
      const reply = unsentReplies[0];
      try {
        const { data: testResult, error: testError } = await supabase.functions.invoke('test-auto-reply', {
          body: {
            replyId: reply.reply_id
          }
        });

        testResults.tests.push({
          test: 'Trigger Reply Test',
          replyId: reply.reply_id,
          replyText: reply.reply_text,
          persona: reply.personas?.name,
          success: testResult?.success || false,
          details: testResult?.message || testError?.message || 'Test completed'
        });

        console.log(`✅ トリガー返信テスト: ${testResult?.success ? '成功' : '失敗'}`);
      } catch (error) {
        console.error('❌ トリガー返信テストエラー:', error);
        testResults.tests.push({
          test: 'Trigger Reply Test',
          success: false,
          details: error.message
        });
      }
    } else {
      testResults.tests.push({
        test: 'Trigger Reply Test',
        success: false,
        details: 'No unsent replies found for testing'
      });
      console.log('ℹ️ トリガー返信テスト対象なし');
    }

    console.log('📊 テスト4: webhookペイロード抽出テスト');
    
    // テスト4: webhookペイロード抽出機能テスト
    const testPayloads = [
      // Meta/Threads標準形式
      {
        entry: [{
          changes: [{
            field: 'mention',
            value: {
              id: 'test-mention-123',
              text: 'テストメンション',
              username: 'testuser'
            }
          }]
        }]
      },
      // 既存形式
      {
        values: [{
          field: 'replies',
          value: {
            id: 'test-reply-456',
            text: 'テストリプライ',
            username: 'testuser2'
          }
        }]
      }
    ];

    let payloadTestSuccess = 0;
    for (let i = 0; i < testPayloads.length; i++) {
      // ペイロード抽出ロジックをテスト（実際のコードから抽出）
      const payload = testPayloads[i];
      const replies = [];
      
      if (payload.entry && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if ((change.field === 'mention' || change.field === 'reply') && change.value) {
                replies.push(change.value);
              }
            }
          }
        }
      }
      
      if (payload.values && Array.isArray(payload.values)) {
        for (const valueItem of payload.values) {
          if (valueItem.field === 'replies' && valueItem.value) {
            replies.push(valueItem.value);
          }
        }
      }

      const success = replies.length > 0;
      if (success) payloadTestSuccess++;
      
      testResults.tests.push({
        test: `Webhook Payload Extraction ${i + 1}`,
        success: success,
        details: `Extracted ${replies.length} replies from payload`,
        extractedReplies: replies.map(r => ({ id: r.id, text: r.text }))
      });
    }

    console.log(`✅ webhookペイロード抽出テスト: ${payloadTestSuccess}/${testPayloads.length}件成功`);

    // テスト結果サマリー
    const totalTests = testResults.tests.length;
    const successfulTests = testResults.tests.filter(t => t.success).length;
    const failedTests = totalTests - successfulTests;

    testResults.summary = {
      total: totalTests,
      successful: successfulTests,
      failed: failedTests,
      successRate: totalTests > 0 ? Math.round((successfulTests / totalTests) * 100) : 0
    };

    console.log(`📈 テスト完了: ${successfulTests}/${totalTests}件成功 (${testResults.summary.successRate}%)`);

    return new Response(JSON.stringify(testResults, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    return new Response(JSON.stringify({ 
      error: 'Test execution failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});