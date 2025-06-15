import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { 
      prompt, 
      negative_prompt = "cartoon, 3d, (disfigured), (bad art), (deformed), (poorly drawn), (extra limbs), strange colors, blurry", 
      ip_adapter_scale = 1.0,
      guidance_scale = 7.5, 
      num_inference_steps = 30,
      width = 512,
      height = 768,
      api_url,
      persona_id
    } = await req.json()

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

    if (!persona_id) {
      return new Response(
        JSON.stringify({ error: 'Persona ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get persona's avatar URL
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('avatar_url')
      .eq('id', persona_id)
      .single()

    if (personaError || !persona) {
      return new Response(
        JSON.stringify({ error: 'Persona not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    if (!persona.avatar_url) {
      return new Response(
        JSON.stringify({ error: 'Persona does not have an avatar image' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch and convert avatar image to base64
    console.log('Fetching persona avatar:', persona.avatar_url)
    const avatarResponse = await fetch(persona.avatar_url)
    if (!avatarResponse.ok) {
      throw new Error(`Failed to fetch avatar image: ${avatarResponse.status} ${avatarResponse.statusText}`)
    }

    const avatarArrayBuffer = await avatarResponse.arrayBuffer()
    const avatarBase64 = btoa(String.fromCharCode(...new Uint8Array(avatarArrayBuffer)))

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

    const requestPayload = {
      face_image_b64: avatarBase64,
      prompt,
      negative_prompt,
      ip_adapter_scale,
      guidance_scale,
      num_inference_steps,
      width,
      height
    }

    console.log('Request payload:', { ...requestPayload, face_image_b64: '[BASE64_DATA]' })

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    if (!data.image_b64) {
      throw new Error('No image data received from API')
    }

    // Base64データをdata URLに変換
    const imageDataUrl = `data:image/png;base64,${data.image_b64}`

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