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
    
    // First, get info about available endpoints
    console.log('Connected to Gradio client, checking endpoints...')
    
    // Try different common endpoint names for image generation
    const possibleEndpoints = ['/predict', '/', '/generate', '/process', '/run']
    
    let result
    let usedEndpoint = ''
    
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`)
        
        // For Gradio, parameters are usually passed as an array in order
        const params = [
          `data:image/png;base64,${payload.face_image_b64}`, // face_image
          payload.prompt, // prompt  
          payload.negative_prompt, // negative_prompt
          payload.ip_adapter_scale, // ip_adapter_scale
          payload.guidance_scale, // guidance_scale
          payload.num_inference_steps, // num_inference_steps
          payload.width, // width
          payload.height // height
        ]
        
        result = await client.predict(endpoint, params)
        usedEndpoint = endpoint
        console.log(`Success with endpoint: ${endpoint}`)
        break
      } catch (endpointError) {
        console.log(`Endpoint ${endpoint} failed:`, endpointError.message)
        continue
      }
    }
    
    if (!result) {
      throw new Error('No valid endpoint found. Available endpoints: ' + possibleEndpoints.join(', '))
    }

    console.log(`Gradio client result from ${usedEndpoint}:`, result)

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
    } else if (imageData && imageData.path) {
      // If it's a file object with path
      imageDataUrl = `${apiEndpoint}/file=${imageData.path}`
    } else {
      throw new Error('Invalid image data format received from API: ' + JSON.stringify(imageData))
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