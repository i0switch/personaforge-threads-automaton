import { corsHeaders } from './config.ts'
import type { GenerateImageRequest } from './types.ts'

export function validateRequest(data: Partial<GenerateImageRequest>): Response | null {
  console.log('Validating request:', {
    hasPrompt: !!data.prompt,
    hasApiUrl: !!data.api_url,
    hasPersonaId: !!data.persona_id,
    prompt: data.prompt,
    api_url: data.api_url,
    persona_id: data.persona_id
  })

  if (!data.prompt) {
    console.error('Missing prompt')
    return new Response(
      JSON.stringify({ error: 'Prompt is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  if (!data.api_url) {
    console.error('Missing api_url')
    return new Response(
      JSON.stringify({ error: 'API URL is required. Please provide your Google Colab ngrok URL.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  if (!data.persona_id) {
    console.error('Missing persona_id')
    return new Response(
      JSON.stringify({ error: 'Persona ID is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  console.log('Validation passed')
  return null
}

export function formatApiUrl(api_url: string): string {
  let apiEndpoint = api_url.trim()
  if (!apiEndpoint.startsWith('http')) {
    apiEndpoint = 'https://' + apiEndpoint
  }
  if (!apiEndpoint.endsWith('/generate')) {
    apiEndpoint = apiEndpoint.replace(/\/$/, '') + '/generate'
  }
  return apiEndpoint
}