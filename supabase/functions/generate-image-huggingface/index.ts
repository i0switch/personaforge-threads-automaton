import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://esm.sh/@gradio/client@0.10.1";

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

    console.log('Initializing Gradio client...');
    const client = await Client.connect(space_url, {
      hf_token: Deno.env.get('HF_TOKEN')
    });
    
    console.log('=== REQUEST DATA DEBUG ===');
    console.log('Face image data type:', typeof face_image);
    console.log('Face image prefix:', face_image.substring(0, 30));
    console.log('Prompt:', prompt);
    console.log('Negative prompt:', negative_prompt);
    console.log('Guidance scale:', guidance_scale);
    console.log('IP adapter scale:', ip_adapter_scale);
    console.log('Num steps:', num_steps);
    console.log('===========================');

    console.log('Calling Gradio API via client...');
    const result = await client.predict("/predict", [
      `data:image/jpeg;base64,${face_image}`, // face_image_numpy
      prompt,                                  // user_prompt  
      negative_prompt,                         // user_negative_prompt
      guidance_scale,                          // guidance_scale
      ip_adapter_scale,                        // ip_adapter_scale
      num_steps                               // num_steps
    ]);

    console.log('Gradio API response received:', result);
    
    // Gradio client returns result.data array
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
          message: 'Image generated successfully via Gradio Client'
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