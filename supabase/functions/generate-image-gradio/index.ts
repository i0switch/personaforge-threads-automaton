
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client, handle_file } from "https://esm.sh/@gradio/client@1.15.3";

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

    // Handle the face image - convert to Blob
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

    if (!imageBlob || imageBlob.size === 0) {
      throw new Error('Invalid image data: Blob is empty or undefined');
    }

    console.log('Image blob type:', imageBlob.type);
    console.log('Image blob size:', imageBlob.size);

    // Connect to the Gradio space
    const client = await Client.connect(space_url);
    
    console.log('Connected to Gradio space successfully');

    // Use handle_file to properly register the image blob
    const imageRef = handle_file(imageBlob);
    console.log('Image registered with handle_file');

    // Call the predict function with correct parameter order (matching app.py)
    // The order must match exactly: [face_image, subject, add_prompt, add_neg, cfg, ip_scale, steps, w, h, upscale, up_factor]
    const result = await client.predict(0, [
      imageRef,                                        // Face image (data[0] - REQUIRED!)
      subject || "portrait",                           // subject
      add_prompt || "",                                // add_prompt
      add_neg || "blurry, low quality, distorted",     // add_neg
      cfg || 6,                                        // cfg
      ip_scale || 0.65,                                // ip_scale
      steps || 20,                                     // steps
      w || 512,                                        // w
      h || 768,                                        // h
      upscale !== undefined ? upscale : true,          // upscale
      up_factor || 2                                   // up_factor
    ]);

    console.log('Gradio result structure:', result);

    if (!result.data || !result.data[0]) {
      throw new Error('No image data returned from Gradio space');
    }

    // The result should contain the generated image data
    const imageData = result.data[0];
    console.log('Generated image data type:', typeof imageData);
    console.log('Generated image data preview:', typeof imageData === 'string' ? imageData.substring(0, 100) + '...' : imageData);
    
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
