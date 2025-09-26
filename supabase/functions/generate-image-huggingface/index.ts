

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://esm.sh/@gradio/client@1.15.3";

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
      (clientOptions as any).hf_token = hfToken;
    }
    
    // Gradio Clientを使用して接続
    const client = await Client.connect("i0switch/my-image-generator", clientOptions);
    console.log('Connected to Gradio client');
    
    // Parameters for debugging
    console.log('=== PARAMETERS DEBUG ===');
    console.log('1. imageFile:', imageFile ? `File(${imageFile.size} bytes, ${imageFile.type})` : 'null');
    console.log('2. prompt (subject):', prompt);
    console.log('3. additional prompt (empty):', "");
    console.log('4. negative_prompt:', negative_prompt);
    console.log('5. guidance_scale:', guidance_scale, typeof guidance_scale);
    console.log('6. ip_adapter_scale:', ip_adapter_scale, typeof ip_adapter_scale);
    console.log('7. num_inference_steps:', num_inference_steps, typeof num_inference_steps);
    console.log('8. width:', width, typeof width);
    console.log('9. height:', height, typeof height);
    console.log('10. upscale:', upscale, typeof upscale);
    console.log('11. upscale_factor:', upscale_factor, typeof upscale_factor);
    
    // predict() に直接 File を渡す方式（推奨）
    console.log('Calling predict with direct File approach...');
    
    const result = await client.predict("/predict", [
      imageFile,           // 1. face_np: File object
      prompt,              // 2. subject: string
      "",                  // 3. add_prompt: string (empty string)
      negative_prompt,     // 4. add_neg: string
      guidance_scale,      // 5. cfg: number (float)
      ip_adapter_scale,    // 6. ip_scale: number (float)
      num_inference_steps, // 7. steps: number (integer)
      width,               // 8. w: number (integer)
      height,              // 9. h: number (integer)
      upscale,             // 10. upscale: boolean
      upscale_factor       // 11. up_factor: number (float)
    ]);

    console.log('=== PROCESSING RESPONSE ===');
    console.log('Result data:', result.data);
    
    if (!result || !result.data || !(result.data as any)[0]) {
      console.error('No valid result received from Gradio');
      throw new Error('No image data received from Gradio API');
    }
    
    let imageData = (result.data as any)[0];
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
        image_data: imageData.split(',')[1], // フロントエンドが期待するbase64データのみ
        image: imageData, // 完全なDataURL
        prompt: prompt,
        message: 'Image generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error type:', error instanceof Error ? error.constructor.name : 'unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Image generation failed', 
        details: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : 'unknown'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

