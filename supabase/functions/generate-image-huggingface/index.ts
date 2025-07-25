

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== Hugging Face Image Generation Starting ===');
    
    const requestBody = await req.json();
    const { 
      prompt,
      negative_prompt = "blurry, low quality, distorted, deformed",
      width = 1024,
      height = 1024
    } = requestBody;

    console.log('Request parameters:', {
      prompt: prompt?.substring(0, 100) + '...',
      negative_prompt,
      width,
      height
    });

    if (!prompt) {
      console.error('No prompt provided');
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const hfToken = Deno.env.get('HF_TOKEN');
    if (!hfToken) {
      console.error('No HF_TOKEN found in environment');
      return new Response(
        JSON.stringify({ error: "Hugging Face token not configured" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Initializing Hugging Face client...');
    const hf = new HfInference(hfToken);

    // Create enhanced prompt for better results
    const enhancedPrompt = `${prompt}, high quality, detailed, beautiful, photorealistic`;
    console.log('Enhanced prompt:', enhancedPrompt);

    console.log('Generating image with FLUX.1-schnell...');
    const image = await hf.textToImage({
      inputs: enhancedPrompt,
      model: 'black-forest-labs/FLUX.1-schnell',
      parameters: {
        negative_prompt: negative_prompt,
        width: width,
        height: height,
        num_inference_steps: 4, // FLUX.1-schnell optimized for 4 steps
      }
    });

    console.log('Image generated successfully');

    // Convert the blob to a base64 string
    const arrayBuffer = await image.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:image/png;base64,${base64}`;

    console.log('Image converted to base64, size:', arrayBuffer.byteLength, 'bytes');

    return new Response(
      JSON.stringify({ 
        success: true,
        image_data: base64, // Base64 data only
        image: dataUrl, // Complete DataURL
        prompt: prompt,
        message: 'Image generated successfully with Hugging Face FLUX.1-schnell'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
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
})

