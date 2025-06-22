
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
    console.log('Parameters:', {
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

    // Handle the face image - convert File to Blob if needed
    let imageBlob;
    if (face_image instanceof File) {
      console.log('Converting File to Blob');
      const arrayBuffer = await face_image.arrayBuffer();
      imageBlob = new Blob([arrayBuffer], { type: face_image.type });
    } else if (typeof face_image === 'string' && face_image.startsWith('data:')) {
      // Handle base64 data URL
      console.log('Converting base64 to Blob');
      const response = await fetch(face_image);
      imageBlob = await response.blob();
    } else if (typeof face_image === 'string' && face_image.startsWith('http')) {
      // Handle URL
      console.log('Fetching image from URL');
      const response = await fetch(face_image);
      imageBlob = await response.blob();
    } else {
      // Assume it's already a Blob
      imageBlob = face_image;
    }

    console.log('Image blob type:', imageBlob?.type);
    console.log('Image blob size:', imageBlob?.size);

    // Connect to the Gradio space
    const client = await Client.connect(space_url);
    
    console.log('Connected to Gradio space successfully');

    // Call the predict function with the correct parameter mapping
    const result = await client.predict("/predict", {
      face_np: imageBlob,
      subject: subject || "portrait",
      add_prompt: add_prompt || "",
      add_neg: add_neg || "blurry, low quality, distorted",
      cfg: cfg || 6,
      ip_scale: ip_scale || 0.65,
      steps: steps || 20,
      w: w || 512,
      h: h || 768,
      upscale: upscale !== undefined ? upscale : true,
      up_factor: up_factor || 2
    });

    console.log('Gradio result structure:', result);

    if (!result.data || !result.data[0]) {
      throw new Error('No image data returned from Gradio space');
    }

    // The result should contain the image data (base64 or URL)
    const imageData = result.data[0];
    console.log('Generated image data type:', typeof imageData);
    
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
