import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders, defaultValues } from './config.ts'
import { validateRequest, formatApiUrl } from './validation.ts'
import { getPersonaAvatar } from './image-utils.ts'
import { callImageGenerationAPI } from './api-client.ts'
import type { GenerateImageRequest, ApiPayload } from './types.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const requestData: Partial<GenerateImageRequest> = await req.json()
    console.log('Received request data:', JSON.stringify(requestData, null, 2))
    
    // Validate request
    const validationError = validateRequest(requestData)
    if (validationError) {
      console.error('Validation error:', validationError)
      return validationError
    }

    // Extract and set defaults
    const {
      prompt,
      negative_prompt = defaultValues.negative_prompt,
      ip_adapter_scale = defaultValues.ip_adapter_scale,
      guidance_scale = defaultValues.guidance_scale,
      num_inference_steps = defaultValues.num_inference_steps,
      width = defaultValues.width,
      height = defaultValues.height,
      api_url,
      persona_id
    } = requestData as GenerateImageRequest

    // Get persona avatar
    const avatarResult = await getPersonaAvatar(persona_id, user.id)
    if (avatarResult instanceof Response) {
      return avatarResult
    }

    // Format API endpoint
    const apiEndpoint = formatApiUrl(api_url)

    // Prepare API payload
    const apiPayload: ApiPayload = {
      face_image_b64: avatarResult.avatarBase64,
      prompt,
      negative_prompt,
      ip_adapter_scale,
      guidance_scale,
      num_inference_steps,
      width,
      height
    }

    // Call image generation API
    const result = await callImageGenerationAPI(apiEndpoint, apiPayload)
    if (result instanceof Response) {
      return result
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in generate-image-stable-diffusion function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})