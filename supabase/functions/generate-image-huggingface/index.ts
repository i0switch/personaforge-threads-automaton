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
    console.log('Face image length:', face_image.length);
    console.log('Space URL:', space_url);

    // Gradio Client compatible payload - use simple array format exactly like the example
    const payload = {
      data: [
        face_image,          // faceImageB64 (base64 without data URL prefix)
        prompt,              // user_prompt
        negative_prompt,     // negative_prompt
        guidance_scale,      // guidance_scale
        ip_adapter_scale,    // ip_adapter_scale
        num_steps           // num_steps
      ]
    };

    console.log('Payload structure:', JSON.stringify(payload, null, 2));

    const apiUrl = `${space_url}/api/predict/generate`;
    console.log('Calling API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "POST", 
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', errorText);
      console.error('Response status:', response.status);
      console.error('Response statusText:', response.statusText);
      
      return new Response(
        JSON.stringify({ 
          error: 'API request failed', 
          details: `${response.status} ${response.statusText}: ${errorText}`,
          status: response.status,
          url: apiUrl
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await response.json();
    console.log('Image generation result:', JSON.stringify(result, null, 2));

    // Check if result has data array
    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
      console.error('Invalid response format:', result);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response format from API',
          details: 'Expected data array in response',
          response: result
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract base64 image data
    let imageData = result.data[0];
    console.log('Raw image data type:', typeof imageData);
    console.log('Raw image data preview:', typeof imageData === 'string' ? imageData.substring(0, 100) : imageData);
    
    // If the response contains a data URL, extract the base64 part
    if (typeof imageData === 'string' && imageData.includes(',')) {
      imageData = imageData.split(',')[1];
      console.log('Extracted base64 data length:', imageData.length);
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