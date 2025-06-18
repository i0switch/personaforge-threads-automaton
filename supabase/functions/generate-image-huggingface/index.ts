import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Gradio API仕様を取得する関数
async function getGradioConfig(spaceUrl: string) {
  try {
    const configResponse = await fetch(`${spaceUrl}/config`);
    if (configResponse.ok) {
      return await configResponse.json();
    }
  } catch (error) {
    console.log('Config endpoint not available, trying info endpoint:', error.message);
  }
  
  try {
    const infoResponse = await fetch(`${spaceUrl}/info`);
    if (infoResponse.ok) {
      return await infoResponse.json();
    }
  } catch (error) {
    console.log('Info endpoint not available:', error.message);
  }
  
  return null;
}

// Gradio API仕様に基づいてリクエストを構築する関数
async function buildGradioRequest(spaceUrl: string, config: any, params: any) {
  const { face_image, prompt, negative_prompt, guidance_scale, ip_adapter_scale, num_steps } = params;
  
  // 利用可能なエンドポイントを確認
  const endpoints = ['/api/predict', '/api/generate', '/call/predict', '/call/generate'];
  let workingEndpoint = null;
  
  for (const endpoint of endpoints) {
    try {
      // OPTIONS リクエストでエンドポイントの存在確認
      const testResponse = await fetch(`${spaceUrl}${endpoint}`, { method: 'OPTIONS' });
      if (testResponse.status !== 404) {
        workingEndpoint = endpoint;
        console.log(`Found working endpoint: ${endpoint}`);
        break;
      }
    } catch (error) {
      console.log(`Endpoint ${endpoint} not available:`, error.message);
    }
  }
  
  if (!workingEndpoint) {
    throw new Error('No working API endpoint found');
  }
  
  // Gradio API呼び出し用のデータ構造を構築
  const requestData = {
    data: [
      `data:image/jpeg;base64,${face_image}`, // face_image_numpy
      prompt,                                  // user_prompt  
      negative_prompt,                         // user_negative_prompt
      guidance_scale,                          // guidance_scale
      ip_adapter_scale,                        // ip_adapter_scale
      num_steps                               // num_steps
    ]
  };
  
  // 追加のGradio固有パラメータ（エンドポイントによって必要な場合）
  if (workingEndpoint.includes('predict')) {
    requestData.fn_index = 0;
    requestData.session_hash = Math.random().toString(36).substring(2);
  }
  
  return { endpoint: workingEndpoint, requestData };
}

serve(async (req) => {
  console.log('Function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const requestBody = await req.json();
    console.log('Request body parsed successfully');
    
    const { 
      space_url,
      face_image, 
      prompt, 
      negative_prompt = "", 
      guidance_scale = 8.0, 
      ip_adapter_scale = 0.6, 
      num_steps = 25 
    } = requestBody;

    console.log('Input validation...');
    if (!face_image || !prompt) {
      console.log('Missing required fields');
      return new Response(
        JSON.stringify({ error: "face_image and prompt are required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!space_url) {
      console.log('Missing space_url');
      return new Response(
        JSON.stringify({ error: "space_url is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('=== DEBUG INFO ===');
    console.log('Space URL:', space_url);
    console.log('Prompt length:', prompt.length);
    console.log('Face image length:', face_image.length);

    // First, test if the Space URL is accessible
    console.log('Testing Space accessibility...');
    try {
      const testResponse = await fetch(space_url);
      console.log('Space accessibility test status:', testResponse.status);
      if (!testResponse.ok) {
        throw new Error(`Space not accessible: ${testResponse.status} ${testResponse.statusText}`);
      }
    } catch (error) {
      console.error('Space accessibility test failed:', error);
      throw new Error(`Cannot access HuggingFace Space: ${error.message}`);
    }

    // Gradio API仕様を自動取得して適応
    console.log('Getting Gradio API configuration...');
    const config = await getGradioConfig(space_url);
    if (config) {
      console.log('Gradio config retrieved:', Object.keys(config));
    } else {
      console.log('No config found, using endpoint discovery');
    }

    // 動的にエンドポイントとリクエストを構築
    console.log('Building Gradio request with auto-adaptation...');
    const { endpoint, requestData } = await buildGradioRequest(space_url, config, {
      face_image,
      prompt,
      negative_prompt,
      guidance_scale,
      ip_adapter_scale,
      num_steps
    });

    console.log(`Calling Gradio API via ${endpoint}...`);
    console.log('Request data structure:', Object.keys(requestData));
    
    const response = await fetch(`${space_url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    console.log('Gradio API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gradio API error response:', errorText);
      throw new Error(`Gradio API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Gradio API response received, data keys:', Object.keys(result));
    
    // Gradio typically returns data in result.data array
    if (result.data && result.data.length > 0) {
      const imageData = result.data[0];
      let base64Image;
      
      if (typeof imageData === 'string') {
        // If it's a URL or base64 string
        if (imageData.startsWith('data:image/')) {
          base64Image = imageData.split(',')[1];
        } else if (imageData.startsWith('http')) {
          // If it's a URL, we need to fetch and convert to base64
          console.log('Fetching image from URL:', imageData);
          const imageResponse = await fetch(imageData);
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          } else {
            throw new Error('Failed to fetch generated image from URL');
          }
        } else {
          // Assume it's already base64
          base64Image = imageData;
        }
      } else {
        console.error('Unexpected image data format:', typeof imageData);
        throw new Error('Unexpected image data format received');
      }

      console.log('Image processing successful');
      return new Response(
        JSON.stringify({ 
          success: true,
          image_data: base64Image,
          message: 'Image generated successfully via Gradio API'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      console.error('No data in Gradio response:', result);
      throw new Error('No image data received from Gradio API');
    }

  } catch (error) {
    console.error('Error in function:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: 'Function failed', 
        details: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});