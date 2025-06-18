import { supabase, corsHeaders } from './config.ts'

export async function getPersonaAvatar(persona_id: string): Promise<{ avatarBase64: string } | Response> {
  console.log('Getting persona avatar for ID:', persona_id)
  
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('avatar_url')
    .eq('id', persona_id)
    .maybeSingle()

  console.log('Persona query result:', { persona, error: personaError })

  if (personaError) {
    console.error('Persona query error:', personaError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch persona', details: personaError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  if (!persona) {
    console.error('Persona not found')
    return new Response(
      JSON.stringify({ error: 'Persona not found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    )
  }

  if (!persona.avatar_url) {
    console.error('Persona has no avatar URL')
    return new Response(
      JSON.stringify({ error: 'Persona does not have an avatar image' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  console.log('Converting avatar URL to base64:', persona.avatar_url)
  const result = await convertImageToBase64(persona.avatar_url)
  if (result instanceof Response) {
    return result
  }
  return result
}

export async function convertImageToBase64(imageUrl: string): Promise<{ avatarBase64: string } | Response> {
  try {
    console.log('Fetching persona avatar:', imageUrl)
    const avatarResponse = await fetch(imageUrl)
    if (!avatarResponse.ok) {
      throw new Error(`Failed to fetch avatar image: ${avatarResponse.status} ${avatarResponse.statusText}`)
    }

    const avatarArrayBuffer = await avatarResponse.arrayBuffer()
    const avatarBase64 = btoa(String.fromCharCode(...new Uint8Array(avatarArrayBuffer)))
    
    return { avatarBase64 }
  } catch (error) {
    console.error('Error processing avatar image:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process avatar image', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}