import { corsHeaders } from './config.ts'
import type { GenerateImageRequest } from './types.ts'

export function validateRequest(data: Partial<GenerateImageRequest>): Response | null {
  if (!data.prompt) {
    return new Response(
      JSON.stringify({ error: 'Prompt is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  if (!data.api_url) {
    return new Response(
      JSON.stringify({ error: 'API URL is required. Please provide your Google Colab ngrok URL.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  if (!data.persona_id) {
    return new Response(
      JSON.stringify({ error: 'Persona ID is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

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