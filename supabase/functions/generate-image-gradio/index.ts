
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

    console.log('Face image type:', typeof face_image);
    console.log('Face image instanceof File:', face_image instanceof File);

    // Handle the face image - convert to proper Blob
    let imageBlob;
    
    if (!face_image) {
      throw new Error('Face image is required but not provided');
    }

    if (face_image instanceof File) {
      console.log('Processing File object:', face_image.name, face_image.type, face_image.size);
      // File is already a valid input for handle_file, but let's convert to Blob for consistency
      const arrayBuffer = await face_image.arrayBuffer();
      imageBlob = new Blob([arrayBuffer], { type: face_image.type || 'image/png' });
    } else if (typeof face_image === 'string') {
      if (face_image.startsWith('data:image/')) {
        // Handle base64 data URL
        console.log('Converting base64 data URL to Blob');
        const response = await fetch(face_image);
        if (!response.ok) {
          throw new Error(`Failed to fetch base64 data: ${response.status}`);
        }
        imageBlob = await response.blob();
      } else if (face_image.startsWith('http')) {
        // Handle URL
        console.log('Fetching image from URL:', face_image.substring(0, 50) + '...');
        const response = await fetch(face_image);
        if (!response.ok) {
          throw new Error(`Failed to fetch image from URL: ${response.status}`);
        }
        imageBlob = await response.blob();
      } else {
        // Assume it's a base64 string without prefix
        console.log('Converting base64 string to Blob');
        const base64Data = face_image.includes(',') ? face_image.split(',')[1] : face_image;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        imageBlob = new Blob([bytes], { type: 'image/png' });
      }
    } else if (face_image instanceof Blob) {
      console.log('Using provided Blob');
      imageBlob = face_image;
    } else {
      throw new Error(`Unsupported face_image type: ${typeof face_image}`);
    }

    // Validate the blob
    if (!imageBlob || imageBlob.size === 0) {
      throw new Error('Invalid image data: Blob is empty or undefined');
    }

    console.log('Final image blob - type:', imageBlob.type, 'size:', imageBlob.size);

    // Connect to the Gradio space
    const client = await Client.connect(space_url);
    console.log('Connected to Gradio space successfully');

    // Use handle_file to properly register the image blob
    const imageRef = handle_file(imageBlob);
    console.log('Image registered with handle_file successfully');

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

    if (!result.data || !(result.data as any)[0]) {
      throw new Error('No image data returned from Gradio space');
    }

    // The result should contain the generated image data
    const imageData = (result.data as any)[0];
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
