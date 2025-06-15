import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { prompt, negative_prompt = "", steps = 30, guidance_scale = 7.5, api_url } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!api_url) {
      return new Response(
        JSON.stringify({ error: 'API URL is required. Please provide your Google Colab ngrok URL.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Validate and format the API URL
    let apiEndpoint = api_url.trim()
    if (!apiEndpoint.startsWith('http')) {
      apiEndpoint = 'https://' + apiEndpoint
    }
    if (!apiEndpoint.endsWith('/generate')) {
      apiEndpoint = apiEndpoint.replace(/\/$/, '') + '/generate'
    }

    console.log('Generating image with prompt:', prompt)
    console.log('Using API endpoint:', apiEndpoint)

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt,
        steps,
        guidance_scale
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    if (!data.image) {
      throw new Error('No image data received from API')
    }

    // Base64データをdata URLに変換
    const imageDataUrl = `data:image/png;base64,${data.image}`

    return new Response(
      JSON.stringify({ 
        success: true,
        image: imageDataUrl,
        prompt: prompt,
        api_url: apiEndpoint
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image',
        details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})