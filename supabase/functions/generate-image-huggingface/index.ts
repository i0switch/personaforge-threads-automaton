import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      space_url,
      face_image, 
      prompt, 
      negative_prompt = "", 
      guidance_scale = 8.0, 
      ip_adapter_scale = 0.6, 
      num_steps = 25 
    } = await req.json();

    if (!face_image || !prompt) {
      return new Response(
        JSON.stringify({ error: "face_image and prompt are required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!space_url) {
      return new Response(
        JSON.stringify({ error: "space_url is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Generating image with Hugging Face Space API...');
    console.log('Original prompt length:', prompt.length);
    console.log('Using prompt:', prompt);

    // Gradio Client compatible payload - use simple array format
    const payload = {
      data: [
        face_image,          // face_image_numpy (base64 without data URL prefix)
        prompt,              // user_prompt
        negative_prompt,     // user_negative_prompt
        guidance_scale,      // guidance_scale
        ip_adapter_scale,    // ip_adapter_scale
        num_steps           // num_steps
      ]
    };

    const apiUrl = `${space_url}/run/generate`;
    console.log('Calling API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "POST", 
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Image generation result:', result);

    // Extract base64 image data
    let imageData = result.data[0];
    
    // If the response contains a data URL, extract the base64 part
    if (typeof imageData === 'string' && imageData.includes(',')) {
      imageData = imageData.split(',')[1];
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        image_data: imageData,
        format: 'base64'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-image-huggingface function:', error);
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