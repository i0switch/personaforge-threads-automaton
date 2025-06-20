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


    console.log('=== CALLING GRADIO API (2-STEP PROCESS) ===');
    console.log('Space URL:', space_url);
    
    // Step 1: POST で event_id を取得
    const payload = {
      data: [
        base64Data,          // face_np (base64 string)
        prompt,              // 被写体説明
        "",                  // 追加プロンプト
        negative_prompt,     // 追加ネガティブ
        guidance_scale,      // CFG
        ip_adapter_scale,    // IP-Adapter scale
        num_inference_steps, // Steps
        width,               // 幅
        height,              // 高さ
        upscale,            // アップスケール
        upscale_factor      // 倍率
      ]
    };
    
    console.log('Step 1: POST request to get event_id');
    const postUrl = `${space_url}/run/predict`;
    console.log('POST URL:', postUrl);
    
    const postResponse = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('Step 1 Error Response:', errorText);
      throw new Error(`Step 1 failed: ${postResponse.status} - ${postResponse.statusText}. Response: ${errorText}`);
    }
    
    const postResult = await postResponse.json();
    const eventId = postResult.event_id;
    console.log('Event ID received:', eventId);
    
    // Step 2: GET で結果取得 (streaming)
    console.log('Step 2: GET request for result');
    const getUrl = `${space_url}/run/predict/${eventId}`;
    console.log('GET URL:', getUrl);
    
    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('Step 2 Error Response:', errorText);
      throw new Error(`Step 2 failed: ${getResponse.status} - ${getResponse.statusText}. Response: ${errorText}`);
    }
    
    // Read the streaming response
    const reader = getResponse.body?.getReader();
    const decoder = new TextDecoder();
    let result = null;
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const jsonData = line.replace(/^data:\s*/, '').trim();
              if (jsonData) {
                const data = JSON.parse(jsonData);
                if (data.data && data.data[0]) {
                  result = data;
                  console.log('Result data received');
                  break;
                }
              }
            } catch (e) {
              console.log('Skipping invalid JSON line:', line);
            }
          }
        }
        if (result) break;
      }
    }
    
    if (!result || !result.data || !result.data[0]) {
      console.error('No valid result received from streaming');
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