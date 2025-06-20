import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { client } from "https://esm.sh/@gradio/client@0.19.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== GRADIO NPM CLIENT: Function called with method:', req.method);
  
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

    // Convert base64 to binary for file creation
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create a File object from the image data
    const imageFile = new File([bytes], 'face_image.jpg', { type: 'image/jpeg' });
    console.log('Created image file, size:', imageFile.size);

    console.log('=== CONNECTING TO GRADIO SPACE ===');
    console.log('Connecting to space:', space_url);
    
    const gradioClient = await client.connect(space_url);
    console.log('Successfully connected to Gradio space');

    console.log('=== CALLING GRADIO PREDICT ===');
    
    // Call the predict function with parameters as object (matching API specification)
    const result = await gradioClient.predict("/predict", {
      face_np: imageFile,           // 顔画像 (File object)
      subject: prompt,              // 被写体説明 (subject description)
      add_prompt: "",               // 追加プロンプト (additional prompt - empty)
      add_neg: negative_prompt,     // 追加ネガティブ (additional negative)
      cfg: guidance_scale,          // CFG (guidance scale)
      ip_scale: ip_adapter_scale,   // IP-Adapter scale
      steps: num_inference_steps,   // steps
      w: width,                     // 幅 (width)
      h: height,                    // 高さ (height)
      upscale: upscale,            // アップスケール (upscale boolean)
      up_factor: upscale_factor    // 倍率 (upscale factor)
    });
    
    console.log('Gradio predict call completed with object parameters');

    console.log('Gradio prediction completed');
    console.log('Result structure:', Object.keys(result));
    console.log('Result data type:', typeof result.data);
    console.log('Result data length:', result.data?.length);

    if (!result || !result.data || !result.data[0]) {
      console.error('Invalid result structure:', result);
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