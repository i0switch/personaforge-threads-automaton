
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
    console.log('Starting Threads post function...');

    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const { postId, userId } = requestBody;

    if (!postId || !userId) {
      const error = 'Missing required fields: postId, userId';
      console.error(error, { postId, userId });
      throw new Error(error);
    }

    console.log(`Publishing post ${postId} to Threads for user ${userId}`);

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

    console.log('Post query result:', { post: post ? 'found' : 'not found', error: postError });

    if (postError) {
      console.error('Post query error:', postError);
      throw new Error(`Post query failed: ${postError.message}`);
    }

    if (!post) {
      const error = 'Post not found or access denied';
      console.error(error, { postId, userId });
      throw new Error(error);
    }

    console.log('Post found:', {
      id: post.id,
      content: post.content.substring(0, 100) + '...',
      hasPersona: !!post.personas,
      hasToken: !!post.personas?.threads_access_token
    });

    if (!post.personas?.threads_access_token) {
      const error = 'Threads access token not configured for this persona';
      console.error(error, { personaId: post.persona_id });
      throw new Error(error);
    }

    const threadsAccessToken = post.personas.threads_access_token;
    console.log(`Publishing post: ${post.content.substring(0, 100)}...`);

    let containerId: string;

    // Check if post has images
    if (post.images && post.images.length > 0) {
      console.log(`Post has ${post.images.length} images, creating image container`);
      
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

      const responseText = await createContainerResponse.text();
      console.log('Image container response:', {
        status: createContainerResponse.status,
        ok: createContainerResponse.ok,
        body: responseText
      });

      if (!createContainerResponse.ok) {
        console.error('Threads create image container error:', responseText);
        throw new Error(`Failed to create Threads image container: ${createContainerResponse.status} ${responseText}`);
      }

      const containerData = JSON.parse(responseText);
      console.log('Image container created:', containerData);
      containerId = containerData.id;

    } else {
      console.log('Creating text-only container');
      
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

      const responseText = await createContainerResponse.text();
      console.log('Text container response:', {
        status: createContainerResponse.status,
        ok: createContainerResponse.ok,
        body: responseText
      });

      if (!createContainerResponse.ok) {
        console.error('Threads create text container error:', responseText);
        throw new Error(`Failed to create Threads text container: ${createContainerResponse.status} ${responseText}`);
      }

      const containerData = JSON.parse(responseText);
      console.log('Text container created:', containerData);
      containerId = containerData.id;
    }

    if (!containerId) {
      const error = 'No container ID returned from Threads API';
      console.error(error);
      throw new Error(error);
    }

    // Wait longer for image processing
    const waitTime = post.images && post.images.length > 0 ? 5000 : 2000;
    console.log(`Waiting ${waitTime}ms for container processing...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Then publish the container (Step 2)
    console.log('Publishing container:', containerId);
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

    const publishResponseText = await publishResponse.text();
    console.log('Publish response:', {
      status: publishResponse.status,
      ok: publishResponse.ok,
      body: publishResponseText
    });

    if (!publishResponse.ok) {
      console.error('Threads publish error:', publishResponseText);
      throw new Error(`Failed to publish to Threads: ${publishResponse.status} ${publishResponseText}`);
    }

    const publishData = JSON.parse(publishResponseText);
    console.log('Post published successfully:', publishData);

    // Update post status in database
    console.log('Updating post status in database...');
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
    } else {
      console.log('Post status updated successfully');
      // Kick off self-reply processor in background (do not await)
      try {
        // Safe fire-and-forget
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        supabase.functions.invoke('self-reply-processor', { body: { limit: 10 } })
          .then((res) => console.log('Triggered self-reply-processor:', res.status))
          .catch((e) => console.error('Failed to trigger self-reply-processor', e));
      } catch (e) {
        console.error('Self-reply trigger error', e);
      }
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
    console.error('Error stack:', error.stack);
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
