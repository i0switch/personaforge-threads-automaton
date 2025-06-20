import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // gradio_clientを使用してSpaceに接続
    console.log('Connecting to Gradio Space using gradio_client...');
    
    // Import gradio_client dynamically
    const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
    
    console.log('Creating Gradio client...');
    const client = await Client.connect(space_url);
    console.log('Connected to Gradio Space successfully');
    
    // 画像データを準備
    const imageBlob = new Blob([Uint8Array.from(atob(face_image), c => c.charCodeAt(0))], {
      type: 'image/jpeg'
    });
    
    console.log('Submitting prediction...');
    const result = await client.predict("/predict", {
      face_image_numpy: imageBlob,
      user_prompt: prompt,
      user_negative_prompt: negative_prompt,
      guidance_scale: guidance_scale,
      ip_adapter_scale: ip_adapter_scale,
      num_steps: num_steps
    });
    
    console.log('Gradio prediction result:', JSON.stringify(result, null, 2));

    
    if (result && result.data && result.data.length > 0) {
      const imageData = result.data[0];
      let base64Image;
      
      if (typeof imageData === 'string') {
        if (imageData.startsWith('data:image/')) {
          base64Image = imageData.split(',')[1];
        } else if (imageData.startsWith('http')) {
          // URLの場合、fetch して base64 に変換
          console.log('Fetching image from URL:', imageData);
          const imageResponse = await fetch(imageData);
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          } else {
            throw new Error('Failed to fetch generated image from URL');
          }
        } else {
          base64Image = imageData;
        }
      } else if (imageData instanceof Blob) {
        // Blobの場合、base64に変換
        const arrayBuffer = await imageData.arrayBuffer();
        base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      } else if (typeof imageData === 'object' && imageData.url) {
        // Gradio FileData objectの場合、URLから画像を取得
        console.log('Fetching image from Gradio FileData URL:', imageData.url);
        const imageResponse = await fetch(imageData.url);
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        } else {
          throw new Error('Failed to fetch generated image from Gradio URL');
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
          message: 'Image generated successfully via Gradio Client'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      console.error('No data in Gradio response:', result);
      throw new Error('No image data received from Gradio Space');
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