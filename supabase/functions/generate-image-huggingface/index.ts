import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== NEW VERSION: Function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const requestBody = await req.json();
    console.log('Request body keys:', Object.keys(requestBody));
    
    const { 
      face_image_b64,
      prompt,
      negative_prompt = "", 
      guidance_scale = 6.0, 
      ip_adapter_scale = 0.65, 
      num_inference_steps = 20,
      width = 512,
      height = 768,
      upscale = true,
      upscale_factor = 2,
      space_url = "https://i0switch-my-image-generator.hf.space"
    } = requestBody;

    console.log('=== VALIDATION ===');
    console.log('face_image_b64 exists:', !!face_image_b64);
    console.log('prompt exists:', !!prompt);
    console.log('space_url:', space_url);

    if (!face_image_b64 || !prompt) {
      console.log('Missing required fields');
      return new Response(
        JSON.stringify({ error: "face_image_b64 and prompt are required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('=== PROCESSING IMAGE ===');
    
    // Remove data URL prefix if present
    const base64Data = face_image_b64.replace(/^data:image\/[a-z]+;base64,/, '');
    console.log('Base64 data length:', base64Data.length);
    
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    console.log('Converted to bytes array, length:', bytes.length);

    // Create image blob
    const imageBlob = new Blob([bytes], { type: 'image/jpeg' });
    console.log('Created image blob, size:', imageBlob.size);

    console.log('=== CALLING GRADIO API ===');
    
    // Prepare data for Gradio API (matching the Python function signature)
    const apiData = [
      imageBlob,           // face_np (numpy array from image)
      prompt,              // subject
      "",                  // add_prompt (additional prompt)
      negative_prompt,     // add_neg (additional negative prompt)
      guidance_scale,      // cfg (guidance scale)
      ip_adapter_scale,    // ip_scale
      num_inference_steps, // steps
      width,               // w
      height,              // h
      upscale,            // upscale
      upscale_factor      // up_factor
    ];

    console.log('API data prepared, parameters count:', apiData.length);

    // Create form data for Gradio
    const formData = new FormData();
    formData.append('data', JSON.stringify(apiData));

    console.log('Sending request to Gradio API...');
    const apiUrl = `${space_url}/api/predict`;
    console.log('API URL:', apiUrl);

    const gradioResponse = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    });

    console.log('Gradio response status:', gradioResponse.status);
    console.log('Gradio response headers:', Object.fromEntries(gradioResponse.headers.entries()));

    if (!gradioResponse.ok) {
      const errorText = await gradioResponse.text();
      console.error('Gradio API error:', errorText);
      throw new Error(`Gradio API failed: ${gradioResponse.status} - ${errorText}`);
    }

    const responseData = await gradioResponse.json();
    console.log('Gradio response structure:', Object.keys(responseData));
    console.log('Gradio response data length:', responseData.data?.length);

    if (!responseData || !responseData.data || !responseData.data[0]) {
      console.error('Invalid response structure:', responseData);
      throw new Error('No image data received from Gradio API');
    }

    console.log('=== PROCESSING RESPONSE ===');
    
    let imageData = responseData.data[0];
    console.log('Image data type:', typeof imageData);
    
    if (typeof imageData === 'string') {
      if (imageData.startsWith('/tmp/') || imageData.includes('.png') || imageData.includes('.jpg')) {
        // It's a file path, need to download the image
        const imagePath = imageData.startsWith('/') ? imageData : `/${imageData}`;
        const imageUrl = `${space_url}/file=${imagePath}`;
        
        console.log('Downloading image from:', imageUrl);
        const imageResponse = await fetch(imageUrl);
        
        if (!imageResponse.ok) {
          console.error('Failed to download image:', imageResponse.status);
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        imageData = `data:image/png;base64,${base64Image}`;
        console.log('Successfully converted image to base64');
        
      } else if (!imageData.startsWith('data:image/')) {
        // Raw base64, add data URL prefix
        imageData = `data:image/png;base64,${imageData}`;
        console.log('Added data URL prefix to base64');
      }
    }

    console.log('=== SUCCESS ===');
    return new Response(
      JSON.stringify({ 
        success: true,
        image: imageData,
        prompt: prompt,
        message: 'Image generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: 'Image generation failed', 
        details: error.message,
        type: error.constructor.name
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});