import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const threadsAccessToken = Deno.env.get('THREADS_ACCESS_TOKEN');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Threads post...');

    if (!threadsAccessToken) {
      throw new Error('THREADS_ACCESS_TOKEN is not configured');
    }

    const { postId, userId } = await req.json();

    if (!postId || !userId) {
      throw new Error('Missing required fields: postId, userId');
    }

    console.log(`Publishing post ${postId} to Threads`);

    // Get post details
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('user_id', userId)
      .single();

    if (postError || !post) {
      throw new Error('Post not found or access denied');
    }

    console.log(`Publishing post: ${post.content.substring(0, 100)}...`);

    // First, create a media container (Step 1)
    const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: post.content,
        access_token: threadsAccessToken
      }),
    });

    if (!createContainerResponse.ok) {
      const errorText = await createContainerResponse.text();
      console.error('Threads create container error:', errorText);
      throw new Error(`Failed to create Threads container: ${createContainerResponse.status} ${errorText}`);
    }

    const containerData = await createContainerResponse.json();
    console.log('Container created:', containerData);

    if (!containerData.id) {
      throw new Error('No container ID returned from Threads API');
    }

    const containerId = containerData.id;

    // Wait a moment for the container to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Then publish the container (Step 2)
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: threadsAccessToken
      }),
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error('Threads publish error:', errorText);
      throw new Error(`Failed to publish to Threads: ${publishResponse.status} ${errorText}`);
    }

    const publishData = await publishResponse.json();
    console.log('Post published:', publishData);

    // Update post status in database
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', postId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating post status:', updateError);
      // Don't throw here as the post was successfully published
    }

    console.log(`Post ${postId} successfully published to Threads`);

    return new Response(
      JSON.stringify({ 
        success: true,
        threads_id: publishData.id,
        message: 'Post published to Threads successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in threads-post function:', error);
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