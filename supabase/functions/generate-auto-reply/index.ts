import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getUserApiKeyDecrypted } from '../_shared/crypto.ts';
import { requireAuthenticatedUser } from '../_shared/auth.ts';

// Phase 2 Security: Rate limiting function
async function checkRateLimit(
  supabase: any,
  endpoint: string,
  identifier: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    
    const { data: recentRequests, error } = await supabase
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('endpoint', endpoint)
      .eq('identifier', identifier)
      .gte('window_start', oneMinuteAgo)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Rate limit check error:', error);
      return { allowed: true }; // エラー時は通過させる（既存機能保護）
    }

    const limit = 30; // 30 replies per minute per persona
    
    if (recentRequests && recentRequests.request_count >= limit) {
      const retryAfter = Math.ceil(
        (new Date(recentRequests.window_start).getTime() + 60000 - Date.now()) / 1000
      );
      return { allowed: false, retryAfter };
    }

    // レート制限記録を更新
    try {
      await supabase.rpc('upsert_rate_limit', {
        p_endpoint: endpoint,
        p_identifier: identifier
      });
    } catch (err) {
      console.error('Failed to update rate limit:', err);
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit error:', error);
    return { allowed: true }; // エラー時は通過させる（既存機能保護）
  }
}

const CORS_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';

function getCorsHeaders(req: Request) {
  const requestOrigin = req.headers.get('origin');
  const configuredOrigin = Deno.env.get('ALLOWED_ORIGIN');

  return {
    'Access-Control-Allow-Origin': requestOrigin ?? configuredOrigin ?? '*',
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Phase 1 Security: Input validation schema
const AutoReplyRequestSchema = z.object({
  postContent: z.string().min(1).max(5000),
  replyContent: z.string().min(1).max(5000),
  persona: z.object({
    id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    name: z.string().max(100),
    age: z.string().max(50).nullish(),
    personality: z.string().max(1000).nullish(),
    expertise: z.array(z.string().max(100)).nullish(),
    tone_of_voice: z.string().max(5000).nullish()
  })
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('📥 generate-auto-reply request', {
    method: req.method,
    origin: req.headers.get('origin') ?? null,
    hasAuthorization: Boolean(req.headers.get('authorization') ?? req.headers.get('Authorization')),
  });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authResult = await requireAuthenticatedUser(req, corsHeaders);
    if (!authResult.ok) {
      return authResult.response;
    }

    const requesterUserId = authResult.userId;

    // Phase 1 Security: Parse and validate request body
    let rawBody;
    try {
      rawBody = await req.json();
    } catch (e) {
      console.error('Invalid JSON in request body:', e);
      throw new Error('Invalid JSON in request body');
    }

    const validationResult = AutoReplyRequestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error('Request validation failed:', validationResult.error);
      throw new Error(`Invalid request format: ${validationResult.error.message}`);
    }

    const { postContent, replyContent, persona } = validationResult.data;
    console.log(`✅ Input validation passed for persona: ${persona.name}`);

    if (persona.user_id && persona.user_id !== requesterUserId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: persona user mismatch' }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (persona.id) {
      const { data: ownedPersona, error: ownershipError } = await supabase
        .from('personas')
        .select('id, user_id')
        .eq('id', persona.id)
        .eq('user_id', requesterUserId)
        .maybeSingle();

      if (ownershipError || !ownedPersona) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: persona ownership required' }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          },
        );
      }
    }

    // Phase 2 Security: Rate limit check
    const personaId = persona.id || 'unknown';
    const rateLimitResult = await checkRateLimit(
      supabase,
      'generate-auto-reply',
      personaId
    );
    
    if (!rateLimitResult.allowed) {
      console.warn(`⚠️ レート制限超過: persona_id=${personaId}`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Too many auto-reply requests.',
          retryAfter: rateLimitResult.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.retryAfter || 60)
          } 
        }
      );
    }

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('暗号化キーが設定されていません');
    }

    // Get all Gemini API keys for the user
    async function getUserApiKey(userId: string, keyName: string): Promise<string | null> {
      return getUserApiKeyDecrypted(supabase, userId, keyName);
    }

    async function getAllGeminiApiKeys(userId: string): Promise<string[]> {
      const apiKeys: string[] = [];
      
      console.log(`🔍 Fetching Gemini API keys for user: ${userId}`);
      
      // Try all possible Gemini API keys (1-10)
      for (let i = 1; i <= 10; i++) {
        const keyName = i === 1 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${i}`;
        console.log(`  Trying key: ${keyName}`);
        const apiKey = await getUserApiKey(userId, keyName);
        if (apiKey) {
          console.log(`  ✅ Found key: ${keyName}`);
          apiKeys.push(apiKey);
        } else {
          console.log(`  ❌ Not found: ${keyName}`);
        }
      }
      
      console.log(`🔑 Total keys found: ${apiKeys.length}`);
      return apiKeys;
    }

    async function generateWithGeminiRotation(prompt: string, userId: string): Promise<string> {
      const apiKeys = await getAllGeminiApiKeys(userId);
      
      if (apiKeys.length === 0) {
        throw new Error('No Gemini API keys configured');
      }
      
      let lastError: Error | null = null;
      
      for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        console.log(`Trying Gemini API key ${i + 1}/${apiKeys.length}`);
        
        try {
          // Updated model name from gemini-pro to gemini-1.5-flash
          const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }]
            })
          });

          if (!response.ok) {
            const error = await response.text();
            console.error('Gemini API error:', error);
            throw new Error(`Gemini API error: ${response.status} ${error}`);
          }

          const data = await response.json();
          console.log('Gemini API response:', data);

          if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response from Gemini API');
          }

          const generatedReply = data.candidates[0].content.parts[0].text;
          console.log(`Successfully generated content with API key ${i + 1}`);
          return generatedReply;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`API key ${i + 1} failed:`, errorMessage);
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Check if it's a quota/rate limit error that should trigger rotation
          if (errorMessage.includes('429') || 
              errorMessage.includes('quota') || 
              errorMessage.includes('RESOURCE_EXHAUSTED') ||
              errorMessage.includes('Rate limit')) {
            console.log(`Rate limit/quota error detected, trying next API key...`);
            continue;
          } else {
            // For other errors, don't continue trying other keys
            throw error;
          }
        }
      }
      
      // If all keys failed, throw the last error
      throw lastError || new Error('All Gemini API keys failed');
    }

    const prompt = `あなたは${persona.name}です。
年齢: ${persona.age || '未設定'}
性格: ${persona.personality || 'フレンドリー'}
話し方: ${persona.tone_of_voice || 'カジュアル'}
専門分野: ${persona.expertise?.join(', ') || 'なし'}

以下のリプライに対して、このペルソナとして自然に返信してください。280文字以内で、ペルソナらしい口調で書いてください。

元の投稿: ${postContent}
リプライ: ${replyContent}`;

  const generatedReply = await generateWithGeminiRotation(prompt, requesterUserId);

    return new Response(
      JSON.stringify({ success: true, reply: generatedReply }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in generate-auto-reply:', error);
    
    return new Response(
      JSON.stringify({ 
        error: (error instanceof Error ? error.message : String(error)) || 'Failed to generate auto reply' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});