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

    // 準備されたリクエストデータ
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
    
    console.log('=== REQUEST DATA DEBUG ===');
    console.log('Data array length:', requestData.data.length);
    console.log('Face image data type:', typeof requestData.data[0]);
    console.log('Face image prefix:', requestData.data[0].substring(0, 30));
    console.log('Prompt:', requestData.data[1]);
    console.log('Negative prompt:', requestData.data[2]);
    console.log('Guidance scale:', requestData.data[3]);
    console.log('IP adapter scale:', requestData.data[4]);
    console.log('Num steps:', requestData.data[5]);
    console.log('===========================');

    console.log('Calling Gradio API via /call/predict (two-step process)...');
    
    // Step 1: POST to /call/predict to get event_id
    const response = await fetch(`${space_url}/call/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    console.log('Step 1 - POST response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gradio API POST error response:', errorText);
      throw new Error(`Gradio API POST error: ${response.status} - ${errorText}`);
    }

    const postResult = await response.json();
    console.log('Step 1 - POST result:', JSON.stringify(postResult, null, 2));
    
    if (!postResult.event_id) {
      throw new Error('No event_id received from Gradio API');
    }

    const eventId = postResult.event_id;
    console.log('Step 2 - Got event_id:', eventId);

    // Step 2: GET the result using event_id
    const getResponse = await fetch(`${space_url}/call/predict/${eventId}`);
    console.log('Step 2 - GET response status:', getResponse.status);
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('Gradio API GET error response:', errorText);
      throw new Error(`Gradio API GET error: ${getResponse.status} - ${errorText}`);
    }

    // Read the streaming response
    const reader = getResponse.body?.getReader();
    let result = null;
    
    if (reader) {
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('Received data:', JSON.stringify(data, null, 2));
              
              if (data.msg === 'process_completed' && data.output) {
                result = data.output;
                break;
              }
            } catch (e) {
              console.log('Failed to parse line:', line);
            }
          }
        }
        
        // Keep the last incomplete line in buffer
        buffer = lines[lines.length - 1];
        
        if (result) break;
      }
    }

    console.log('Final result:', JSON.stringify(result, null, 2));
    
    // Process the result
    if (result && result.data && result.data.length > 0) {
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