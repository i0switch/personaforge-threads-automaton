import { corsHeaders } from './config.ts'
import type { ApiPayload, ApiResponse, GenerateImageResponse } from './types.ts'

export async function callImageGenerationAPI(
  apiEndpoint: string, 
  payload: ApiPayload
): Promise<GenerateImageResponse | Response> {
  try {
    console.log('Generating image with prompt:', payload.prompt)
    console.log('Using API endpoint:', apiEndpoint)
    console.log('Request payload:', { ...payload, face_image_b64: '[BASE64_DATA]' })

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`)
    }

    const data: ApiResponse = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    if (!data.image_b64) {
      throw new Error('No image data received from API')
    }

    // Base64データをdata URLに変換
    const imageDataUrl = `data:image/png;base64,${data.image_b64}`

    return {
      success: true,
      image: imageDataUrl,
      prompt: payload.prompt,
      api_url: apiEndpoint
    }
  } catch (error) {
    console.error('Error calling image generation API:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image',
        details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}