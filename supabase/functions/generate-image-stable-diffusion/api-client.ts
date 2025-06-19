import { corsHeaders } from './config.ts'
import type { ApiPayload, GenerateImageResponse } from './types.ts'

export async function callImageGenerationAPI(
  apiEndpoint: string, 
  payload: ApiPayload
): Promise<GenerateImageResponse | Response> {
  try {
    console.log('Generating image with prompt:', payload.prompt)
    console.log('Using API endpoint:', apiEndpoint)
    console.log('Request payload:', { ...payload, face_image_b64: '[BASE64_DATA]' })

    // Use Gradio client for more reliable API calls
    const { Client } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js')
    
    const client = await Client.connect(apiEndpoint)
    
    const result = await client.predict("/process_image", {
      face_image: `data:image/png;base64,${payload.face_image_b64}`,
      prompt: payload.prompt,
      negative_prompt: payload.negative_prompt,
      ip_adapter_scale: payload.ip_adapter_scale,
      guidance_scale: payload.guidance_scale,
      num_inference_steps: payload.num_inference_steps,
      width: payload.width,
      height: payload.height
    })

    console.log('Gradio client result:', result)

    if (!result.data || !result.data[0]) {
      throw new Error('No image data received from Gradio API')
    }

    // Extract image from Gradio response
    const imageData = result.data[0]
    let imageDataUrl: string

    if (typeof imageData === 'string') {
      // If it's already a data URL or base64
      imageDataUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`
    } else if (imageData && imageData.url) {
      // If it's a file object with URL
      imageDataUrl = imageData.url
    } else {
      throw new Error('Invalid image data format received from API')
    }

    return {
      success: true,
      image: imageDataUrl,
      prompt: payload.prompt,
      api_url: apiEndpoint
    }
  } catch (error) {
    console.error('Error calling Gradio API:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image with Gradio client',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}