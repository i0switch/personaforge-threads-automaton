
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto reply process...');

    const body = await req.json();
    console.log('Request body:', body);

    const { postContent, replyContent, replyId, personaId, userId } = body;

    // より詳細なパラメータ検証
    if (!replyContent) {
      console.error('Missing replyContent');
      throw new Error('replyContent is required');
    }
    if (!replyId) {
      console.error('Missing replyId');
      throw new Error('replyId is required for creating a reply');
    }
    if (!personaId) {
      console.error('Missing personaId');
      throw new Error('personaId is required');
    }
    if (!userId) {
      console.error('Missing userId');
      throw new Error('userId is required');
    }

    console.log('Parameters validated:', {
      postContent: postContent ? 'present' : 'empty',
      replyContent: replyContent?.substring(0, 50) + '...',
      replyId,
      personaId,
      userId
    });

    // Get persona information with detailed fields
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('user_id', userId)
      .single();

    if (personaError || !persona) {
      console.error('Persona error:', personaError);
      throw new Error('Persona not found');
    }

    console.log('Persona found:', persona.name);

    if (!persona.threads_access_token) {
      throw new Error('Threads access token not configured for this persona');
    }

    // 元の投稿内容を取得する（もし可能であれば）
    let originalPostContent = postContent || '';
    if (!originalPostContent) {
      // 投稿内容を取得する試み（必要に応じて実装）
      console.log('No original post content provided, using empty string');
    }

    // ペルソナのサンプル投稿を準備
    const styleGuide = [
      persona.personality ? `性格: ${persona.personality}` : '',
      persona.age ? `年齢: ${persona.age}` : '',
      persona.tone_of_voice ? `話し方: ${persona.tone_of_voice}` : '',
      persona.expertise && persona.expertise.length > 0 ? `専門分野: ${persona.expertise.join(', ')}` : ''
    ].filter(Boolean).join('\n');

    // 改善されたプロンプトを使用
    const prompt = [
      'あなたは、ソーシャルメディア「Threads」で活躍する、経験豊富なコミュニティマネージャーです。',
      'あなたのゴールは、受信したリプライに対して、あなたのペルソナに沿った、人間らしく、魅力的で、気の利いた返信を生成し、会話を促進することです。',
      '---',
      '## あなたのペルソナ情報',
      `* **ペルソナ名**: ${persona.name}`,
      `* **口調・スタイルガイド**: ${styleGuide}`,
      '---',
      '## 返信タスクの背景',
      '以下の「元の投稿」に対して、あるユーザーから「受信リプライ」が届きました。',
      `* **元の投稿**: ${originalPostContent || '(本文なし)'}`,
      `* **受信リプライ**: ${replyContent}`,
      '---',
      '## あなたへの指示',
      '上記の「受信リプライ」に対して、以下の「厳格なルール」をすべて守り、最も適切で自然な返信を生成してください。',
      '### 厳格なルール',
      '- **思考プロセス**: まず受信リプライの意図（質問、感想、共感など）を分析し、次にあなたのペルソナならどう応答するかを考え、それから返信文を作成してください。',
      '- **ペルソナの一貫性**: 必ず上記「あなたのペルソナ情報」に記載された口調、スタイル、過去のサンプル投稿のトーンを忠実に守ってください。',
      '- **自然な会話**: 機械的な応答は絶対に避けてください。人間同士の自然な会話の流れを意識してください。',
      '- **簡潔さ**: 返信は簡潔に、最大でも280文字程度に収めてください。',
      '- **絵文字**: ペルソナのスタイルに合致する場合のみ、控えめに使用してください。',
      '- **禁止事項**: 署名や挨拶（「こんにちは」など）で始めないでください。ハッシュタグは使用しないでください。質問に質問で返すことは避けてください。',
      '- **出力形式**: 生成する返信文のみを出力してください。思考プロセスや言い訳、前置きは一切含めないでください。'
    ].join('\n');

    console.log('Calling Gemini API...');

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    const generatedReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedReply) {
      throw new Error('No reply generated from Gemini');
    }

    console.log('Generated reply:', generatedReply);

    // Create reply to the original reply using Threads API
    console.log('Creating Threads reply container...');
    const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT_POST',
        text: generatedReply,
        reply_to_id: replyId,
        access_token: persona.threads_access_token
      }),
    });

    if (!createContainerResponse.ok) {
      const errorText = await createContainerResponse.text();
      console.error('Threads create container error:', errorText);
      throw new Error(`Failed to create Threads container: ${createContainerResponse.status} - ${errorText}`);
    }

    const containerData = await createContainerResponse.json();
    console.log('Reply container created:', containerData.id);

    if (!containerData.id) {
      throw new Error('No container ID returned from Threads API');
    }

    // Wait and publish
    console.log('Waiting before publish...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Publishing reply to Threads...');
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: persona.threads_access_token
      }),
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error('Threads publish error:', errorText);
      throw new Error(`Failed to publish to Threads: ${publishResponse.status} - ${errorText}`);
    }

    const publishData = await publishResponse.json();
    console.log('Reply published:', publishData.id);

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        persona_id: personaId,
        action_type: 'auto_reply_sent',
        description: 'AI自動返信を送信しました',
        metadata: {
          original_post: originalPostContent || '(empty)',
          reply_to: replyContent,
          reply_to_id: replyId,
          generated_reply: generatedReply,
          threads_id: publishData.id
        }
      });

    console.log('Auto reply completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        reply: generatedReply,
        threads_id: publishData.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in auto reply function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
