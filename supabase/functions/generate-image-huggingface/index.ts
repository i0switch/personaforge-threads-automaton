import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== GRADIO REST API: Function called with method:', req.method);
  
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
    
    // Remove data URL prefix if present to get pure base64
    const base64Data = face_image_b64.replace(/^data:image\/[a-z]+;base64,/, '');
    console.log('Base64 data length:', base64Data.length);


    console.log('=== CALLING GRADIO API ===');
    console.log('Space URL:', space_url);
    
    // app.pyの generate 関数の引数順序に合わせる
    const payload = {
      data: [
        base64Data,          // face_np (numpy array として base64)
        prompt,              // subject (被写体説明)
        "",                  // add_prompt (追加プロンプト)
        negative_prompt,     // add_neg (追加ネガティブ)
        guidance_scale,      // cfg (CFG scale)
        ip_adapter_scale,    // ip_scale (IP-Adapter scale)
        num_inference_steps, // steps (Steps)
        width,               // w (幅)
        height,              // h (高さ)
        upscale,            // upscale (アップスケール)
        upscale_factor      // up_factor (倍率)
      ]
    };
    
    console.log('Calling Gradio API');
    const apiUrl = `${space_url}/api/predict`;
    console.log('API URL:', apiUrl);
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // HuggingFace トークンがある場合は認証ヘッダーを追加
    const hfToken = Deno.env.get('HF_TOKEN');
    if (hfToken) {
      console.log('Using HF_TOKEN for authentication');
      headers['Authorization'] = `Bearer ${hfToken}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API failed: ${response.status} - ${response.statusText}. Response: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API response received');
    console.log('Response structure:', Object.keys(result));
    
    if (!result || !result.data || !result.data[0]) {
      console.error('No valid result received from API');
      throw new Error('No image data received from Gradio API');
    }
    console.log('=== PROCESSING RESPONSE ===');
    
    let imageData = result.data[0];
    console.log('Image data type:', typeof imageData);
    console.log('Image data preview:', typeof imageData === 'string' ? imageData.substring(0, 100) : 'Not a string');
    
    if (typeof imageData === 'object' && imageData.url) {
      // It's an object with URL property
      const imageUrl = imageData.url;
      console.log('Downloading image from URL:', imageUrl);
      
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      imageData = `data:image/png;base64,${base64Image}`;
      console.log('Successfully converted image to base64');
      
    } else if (typeof imageData === 'string') {
      if (imageData.startsWith('http')) {
        // It's a URL, download it
        console.log('Downloading image from URL:', imageData);
        const imageResponse = await fetch(imageData);
        
        if (!imageResponse.ok) {
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