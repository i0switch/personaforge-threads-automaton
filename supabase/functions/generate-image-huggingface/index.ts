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

    // 準備されたリクエストデータ - 多くのGradio Spaceで使用される標準的な形式
    const requestData = {
      data: [
        `data:image/jpeg;base64,${face_image}`, // 画像データ
        prompt,                                  // プロンプト
        negative_prompt,                         // ネガティブプロンプト
        guidance_scale,                          // ガイダンススケール
        ip_adapter_scale,                        // IPアダプタースケール
        num_steps                               // ステップ数
      ]
    };
    
    console.log('=== REQUEST DATA DEBUG ===');
    console.log('Data array length:', requestData.data.length);
    console.log('Face image prefix:', requestData.data[0].substring(0, 30));
    console.log('Prompt:', requestData.data[1]);
    console.log('===========================');

    // 一般的なGradio APIエンドポイントを試行
    const endpoints = [
      `/api/predict`,
      `/call/predict`,
      `/run/predict`
    ];

    let success = false;
    let finalResult = null;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${space_url}${endpoint}`);
        const response = await fetch(`${space_url}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });

        console.log(`${endpoint} response status:`, response.status);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log(`${endpoint} result:`, JSON.stringify(result, null, 2));
            
            // 直接的な結果の場合
            if (result.data && Array.isArray(result.data) && result.data.length > 0) {
              console.log('Got direct result');
              finalResult = result;
              success = true;
              break;
            }
            
            // event_idがある場合は次のステップへ
            if (result.event_id) {
              console.log(`Got event_id: ${result.event_id}`);
              try {
                const eventResponse = await fetch(`${space_url}/call/predict/${result.event_id}`, {
                  headers: {
                    'Accept': 'text/event-stream',
                  }
                });
                
                if (eventResponse.ok) {
                  const responseText = await eventResponse.text();
                  console.log('Event response text:', responseText.substring(0, 500));
                  
                  // Server-sent eventsをパース
                  const lines = responseText.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.slice(6));
                        if (data.msg === 'process_completed' && data.output && data.output.data) {
                          finalResult = data.output;
                          success = true;
                          break;
                        }
                      } catch (e) {
                        console.log('Failed to parse event line:', line.substring(0, 100));
                      }
                    }
                  }
                  
                  if (success) break;
                }
              } catch (eventError) {
                console.log('Event handling failed:', eventError.message);
              }
            }
          }
        } else {
          const text = await response.text();
          console.log(`${endpoint} error response:`, text.substring(0, 200));
        }
      } catch (e) {
        console.log(`${endpoint} failed:`, e.message);
      }
    }

    if (!success || !finalResult) {
      throw new Error('Could not get response from any Gradio API endpoint. The Space might be sleeping, private, or using a different API structure.');
    }

    // 結果を処理
    if (finalResult && finalResult.data && finalResult.data.length > 0) {
      const imageData = finalResult.data[0];
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
          // すでにbase64の場合
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
      console.error('No valid data in final result:', finalResult);
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