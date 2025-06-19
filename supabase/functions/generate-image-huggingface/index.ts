import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const requestBody = await req.json();
    console.log('Request body parsed successfully');
    
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

    console.log('Input validation...');
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

    console.log('=== DEBUG INFO ===');
    console.log('Space URL:', space_url);
    console.log('Prompt length:', prompt.length);
    console.log('Face image length:', face_image_b64.length);

    console.log('Calling Gradio API directly...');
    
    try {
      // Convert base64 to Uint8Array
      const base64Data = face_image_b64.replace(/^data:image\/[a-z]+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create form data for Gradio API predict endpoint
      const formData = new FormData();
      
      // Create a blob from the image data
      const imageBlob = new Blob([bytes], { type: 'image/jpeg' });
      
      // Gradio expects parameters in a specific format
      const data = [
        imageBlob,           // face_np
        prompt,              // subject
        "",                  // add_prompt  
        negative_prompt,     // add_neg
        guidance_scale,      // cfg
        ip_adapter_scale,    // ip_scale
        num_inference_steps, // steps
        width,               // w
        height,              // h
        upscale,            // upscale
        upscale_factor      // up_factor
      ];

      formData.append('data', JSON.stringify(data));

      console.log('Sending request to Gradio API...');
      const gradioResponse = await fetch(`${space_url}/api/predict`, {
        method: 'POST',
        body: formData,
      });

      console.log('Gradio API response status:', gradioResponse.status);

      if (!gradioResponse.ok) {
        const errorText = await gradioResponse.text();
        console.error('Gradio API error response:', errorText);
        throw new Error(`Gradio API failed with status ${gradioResponse.status}: ${errorText}`);
      }

      const result = await gradioResponse.json();
      console.log('Gradio API response received successfully');

      if (!result || !result.data || !result.data[0]) {
        console.error('Unexpected response format:', result);
        throw new Error('No image data received from Gradio API');
      }

      // Handle the response - Gradio typically returns file paths
      let imageData = result.data[0];
      
      if (typeof imageData === 'string') {
        if (imageData.startsWith('/tmp/') || imageData.startsWith('file=')) {
          // If it's a file path, construct the full URL
          const filePath = imageData.startsWith('file=') ? imageData.substring(5) : imageData;
          const imageUrl = `${space_url}/file=${filePath}`;
          
          console.log('Fetching generated image from:', imageUrl);
          const imageResponse = await fetch(imageUrl);
          
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from ${imageUrl}: ${imageResponse.status}`);
          }
          
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
          imageData = `data:image/png;base64,${base64Image}`;
        } else if (!imageData.startsWith('data:image/')) {
          // If it's raw base64, add the data URL prefix
          imageData = `data:image/png;base64,${imageData}`;
        }
      }

      console.log('Image processing successful');
      return new Response(
        JSON.stringify({ 
          success: true,
          image: imageData,
          prompt: prompt
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (apiError) {
      console.error('Gradio API call failed:', apiError);
      throw new Error(`Failed to call Gradio API: ${apiError.message}`);
    }

  } catch (error) {
    console.error('Error in function:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: 'Image generation failed', 
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});