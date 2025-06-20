import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://esm.sh/@gradio/client@1.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== GRADIO CLIENT: Function called with method:', req.method);
  
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
    console.log('face_image_b64 first 50 chars:', face_image_b64?.substring(0, 50));
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

    // DataURLからFileを作成
    console.log('Converting DataURL to File...');
    const base64Data = face_image_b64.split(',')[1];
    const mimeType = face_image_b64.split(',')[0].split(':')[1].split(';')[0];
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: mimeType });
    
    // BlobをFileに変換（Gradio APIはFile型を期待している）
    const imageFile = new File([imageBlob], "face.png", { type: mimeType });
    console.log('Successfully converted to File, size:', imageFile.size, 'type:', imageFile.type);

    console.log('=== CALLING GRADIO CLIENT ===');
    console.log('Space URL:', space_url);
    
    // HuggingFace トークンの設定
    const hfToken = Deno.env.get('HF_TOKEN');
    const clientOptions = {};
    if (hfToken) {
      console.log('Using HF_TOKEN for authentication');
      clientOptions.hf_token = hfToken;
    }
    
    // Gradio Clientを使用して接続
    const client = await Client.connect("i0switch/my-image-generator", clientOptions);
    console.log('Connected to Gradio client');
    
    // APIを呼び出し（配列形式で引数の順番通りに渡す）
    const result = await client.predict("/predict", [
      imageFile,           // 1. face_np (File型)
      prompt,              // 2. subject
      "",                  // 3. add_prompt
      negative_prompt,     // 4. add_neg
      guidance_scale,      // 5. cfg
      ip_adapter_scale,    // 6. ip_scale
      num_inference_steps, // 7. steps
      width,               // 8. w
      height,              // 9. h
      upscale,             // 10. upscale
      upscale_factor       // 11. up_factor
    ]);

    console.log('=== PROCESSING RESPONSE ===');
    console.log('Result data:', result.data);
    
    if (!result || !result.data || !result.data[0]) {
      console.error('No valid result received from Gradio');
      throw new Error('No image data received from Gradio API');
    }
    
    let imageData = result.data[0];
    console.log('Image data type:', typeof imageData);
    
    // 結果の処理
    if (typeof imageData === 'object' && imageData.url) {
      // URLの場合は画像をダウンロード
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
        // URLの場合
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
        // Raw base64の場合
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