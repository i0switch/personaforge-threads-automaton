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
    
    // Step 1: Send request to get event_id
    const payload = {
      data: [
        {
          name: "face_np",
          shape: null,
          datatype: "BYTES",
          data: base64Data
        },
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
    
    console.log('Step 1: Sending request to get event_id');
    const callUrl = `${space_url}/call/predict`;
    console.log('Call URL:', callUrl);
    
    const callResponse = await fetch(callUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!callResponse.ok) {
      const errorText = await callResponse.text();
      console.error('Step 1 Error Response:', errorText);
      throw new Error(`Step 1 failed: ${callResponse.status} - ${callResponse.statusText}. Response: ${errorText}`);
    }
    
    const callResult = await callResponse.json();
    const eventId = callResult.event_id;
    console.log('Event ID received:', eventId);
    
    // Step 2: Get result using streaming
    console.log('Step 2: Getting result via streaming');
    const resultUrl = `${space_url}/call/predict/${eventId}`;
    console.log('Result URL:', resultUrl);
    
    const resultResponse = await fetch(resultUrl);
    
    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      console.error('Step 2 Error Response:', errorText);
      throw new Error(`Step 2 failed: ${resultResponse.status} - ${resultResponse.statusText}. Response: ${errorText}`);
    }
    
    // Read the streaming response
    const reader = resultResponse.body?.getReader();
    const decoder = new TextDecoder();
    let result = null;
    let completed = false;
    
    if (reader) {
      while (!completed) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('event: complete')) {
            console.log('Stream completed!');
            completed = true;
          } else if (line.startsWith('data: ')) {
            try {
              const jsonData = line.substring(6); // Remove "data: " prefix
              const data = JSON.parse(jsonData);
              if (data.data && data.data[0]) {
                result = data;
                console.log('Result data received');
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    }
    
    if (!result || !result.data || !result.data[0]) {
      console.error('No valid result received from streaming');
      throw new Error('No image data received from Gradio API streaming');
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