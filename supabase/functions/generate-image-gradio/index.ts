
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://esm.sh/@gradio/client@1.15.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      space_url,
      face_image,
      subject,
      add_prompt,
      add_neg,
      cfg,
      ip_scale,
      steps,
      w,
      h,
      upscale,
      up_factor
    } = await req.json();

    console.log('Connecting to Gradio space:', space_url);

    // Convert File to Blob if needed
    let imageBlob;
    if (face_image instanceof File) {
      const arrayBuffer = await face_image.arrayBuffer();
      imageBlob = new Blob([arrayBuffer], { type: face_image.type });
    } else {
      // Assume it's already a Blob or similar
      imageBlob = face_image;
    }

    // Connect to the Gradio space
    const client = await Client.connect(space_url);
    
    console.log('Calling predict with parameters:', {
      subject,
      add_prompt,
      add_neg,
      cfg,
      ip_scale,
      steps,
      w,
      h,
      upscale,
      up_factor
    });

    const result = await client.predict("/predict", {
      face_np: imageBlob,
      subject: subject || "Hello!!",
      add_prompt: add_prompt || "Hello!!",
      add_neg: add_neg || "Hello!!",
      cfg: cfg || 6,
      ip_scale: ip_scale || 0.65,
      steps: steps || 20,
      w: w || 512,
      h: h || 768,
      upscale: upscale !== undefined ? upscale : true,
      up_factor: up_factor || 2
    });

    console.log('Gradio result:', result);

    if (!result.data || !result.data[0]) {
      throw new Error('No image data returned from Gradio space');
    }

    // The result should contain the image URL or base64 data
    const imageData = result.data[0];
    
    return new Response(
      JSON.stringify({
        success: true,
        image: imageData,
        message: 'Image generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in generate-image-gradio function:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate image',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
