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

    // First check if the endpoint is accessible
    console.log('Checking if API endpoint is accessible...')
    const testResponse = await fetch(apiEndpoint, { method: 'GET' })
    console.log('Test response status:', testResponse.status)
    console.log('Test response headers:', Object.fromEntries(testResponse.headers.entries()))
    
    if (!testResponse.ok) {
      throw new Error(`API endpoint not accessible: ${testResponse.status} ${testResponse.statusText}`)
    }

    const responseText = await testResponse.text()
    console.log('Response preview:', responseText.substring(0, 500))
    
    if (responseText.includes('<!doctype') || responseText.includes('<html')) {
      throw new Error('API endpoint returned HTML instead of a valid Gradio interface. Please check if the Space URL is correct and the Space is running.')
    }

    // Use Gradio client for more reliable API calls
    const { Client } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js')
    
    console.log('Connecting to Gradio client...')
    const client = await Client.connect(apiEndpoint)
    
    console.log('Connected to Gradio client successfully')
    
    // Convert base64 to File object for Gradio
    const base64Data = payload.face_image_b64
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const faceImageFile = new File([byteArray], 'face.png', { type: 'image/png' })
    
    // Parameters in correct order for Gradio inputs
    const params = [
      faceImageFile, // face_image (File object)
      payload.prompt, // prompt  
      payload.negative_prompt, // negative_prompt
      payload.guidance_scale, // guidance_scale
      payload.ip_adapter_scale, // ip_adapter_scale
      payload.num_inference_steps, // num_inference_steps
      payload.width, // width
      payload.height // height
    ]
    
    console.log('Calling /predict endpoint with parameters')
    const result = await client.predict('/predict', params)
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