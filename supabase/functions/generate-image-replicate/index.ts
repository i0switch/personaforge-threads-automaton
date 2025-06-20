import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== REPLICATE API: Function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not set');
    }

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
    } = requestBody;

    console.log('=== VALIDATION ===');
    console.log('face_image_b64 exists:', !!face_image_b64);
    console.log('face_image_b64 first 50 chars:', face_image_b64?.substring(0, 50));
    console.log('prompt exists:', !!prompt);

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
    
    // DataURL形式のチェック
    if (!face_image_b64.startsWith('data:image/')) {
      console.log('Invalid image format - not a DataURL');
      return new Response(
        JSON.stringify({ error: "Invalid image format. Expected DataURL format." }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('=== CALLING REPLICATE API ===');
    
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Face swapping model using Replicate
    const output = await replicate.run(
      "lucataco/faceswap:9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d",
      {
        input: {
          target_image: face_image_b64,
          swap_image: face_image_b64, // 同じ画像を使用してスタイル変更
          prompt: prompt,
          negative_prompt: negative_prompt,
          guidance_scale: guidance_scale,
          num_inference_steps: num_inference_steps,
          width: width,
          height: height,
        }
      }
    );

    console.log('=== PROCESSING RESPONSE ===');
    console.log('Output:', output);
    
    if (!output || !output[0]) {
      console.error('No valid result received from Replicate');
      throw new Error('No image data received from Replicate API');
    }
    
    let imageData = output[0];
    console.log('Image data type:', typeof imageData);
    
    // URLの場合は画像をダウンロードしてBase64に変換
    if (typeof imageData === 'string' && imageData.startsWith('http')) {
      console.log('Downloading image from URL:', imageData);
      const imageResponse = await fetch(imageData);
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      imageData = `data:image/png;base64,${base64Image}`;
      console.log('Successfully converted image to base64');
    }

    console.log('=== SUCCESS ===');
    return new Response(
      JSON.stringify({ 
        success: true,
        image: imageData,
        prompt: prompt,
        message: 'Image generated successfully using Replicate'
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