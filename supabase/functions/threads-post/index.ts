
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Threads post...');

    const { postId, userId } = await req.json();

    if (!postId || !userId) {
      throw new Error('Missing required fields: postId, userId');
    }

    console.log(`Publishing post ${postId} to Threads`);

    // Get post details with persona info
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(`
        *,
        personas!inner(threads_access_token)
      `)
      .eq('id', postId)
      .eq('user_id', userId)
      .single();

    if (postError || !post) {
      throw new Error('Post not found or access denied');
    }

    if (!post.personas?.threads_access_token) {
      throw new Error('Threads access token not configured for this persona');
    }

    const threadsAccessToken = post.personas.threads_access_token;
    console.log(`Publishing post: ${post.content.substring(0, 100)}...`);

    let containerId: string;

    // Check if post has images
    if (post.images && post.images.length > 0) {
      console.log(`Post has ${post.images.length} images`);
      
      // For image posts, create container with IMAGE media type
      const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_type: 'IMAGE',
          image_url: post.images[0], // Use first image
          text: post.content,
          access_token: threadsAccessToken
        }),
      });

      if (!createContainerResponse.ok) {
        const errorText = await createContainerResponse.text();
        console.error('Threads create image container error:', errorText);
        throw new Error(`Failed to create Threads image container: ${createContainerResponse.status} ${errorText}`);
      }

      const containerData = await createContainerResponse.json();
      console.log('Image container created:', containerData);
      containerId = containerData.id;

    } else {
      // For text-only posts
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
        console.error('Threads create text container error:', errorText);
        throw new Error(`Failed to create Threads text container: ${createContainerResponse.status} ${errorText}`);
      }

      const containerData = await createContainerResponse.json();
      console.log('Text container created:', containerData);
      containerId = containerData.id;
    }

    if (!containerId) {
      throw new Error('No container ID returned from Threads API');
    }

    // Wait longer for image processing
    const waitTime = post.images && post.images.length > 0 ? 5000 : 2000;
    console.log(`Waiting ${waitTime}ms for container processing...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

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
