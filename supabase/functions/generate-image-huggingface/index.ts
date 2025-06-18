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

    // Try different API endpoints
    const apiEndpoints = ['/api/predict', '/predict', '/api/v1/predict'];
    let successfulResponse = null;
    let lastError = null;

    for (const endpoint of apiEndpoints) {
      try {
        console.log(`Trying endpoint: ${space_url}${endpoint}`);
        
        const response = await fetch(`${space_url}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: [
              `data:image/jpeg;base64,${face_image}`,
              prompt,
              negative_prompt,
              guidance_scale,
              ip_adapter_scale,
              num_steps
            ]
          })
        });

        console.log(`Response status for ${endpoint}:`, response.status);
        
        if (response.ok) {
          successfulResponse = await response.json();
          console.log('Successful response received from:', endpoint);
          break;
        } else {
          console.log(`Endpoint ${endpoint} failed with status:`, response.status);
          lastError = new Error(`API endpoint ${endpoint} returned: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error);
        lastError = error;
      }
    }

    if (!successfulResponse) {
      console.error('All API endpoints failed. Last error:', lastError);
      throw new Error(`All API endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    console.log('Processing successful response...');
    
    if (successfulResponse.data && successfulResponse.data[0]) {
      // Extract base64 image data from the response
      const imageData = successfulResponse.data[0];
      let base64Image;
      
      if (imageData.startsWith('data:image/')) {
        // Remove data URL prefix if present
        base64Image = imageData.split(',')[1];
      } else {
        base64Image = imageData;
      }

      console.log('Image generation successful');
      return new Response(
        JSON.stringify({ 
          success: true,
          image_data: base64Image,
          message: 'Image generated successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      console.error('No image data in response:', successfulResponse);
      throw new Error('No image data received from HuggingFace API');
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