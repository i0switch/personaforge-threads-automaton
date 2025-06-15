import { supabase, corsHeaders } from './config.ts'

export async function getPersonaAvatar(persona_id: string): Promise<{ avatarBase64: string } | Response> {
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

  return await convertImageToBase64(persona.avatar_url)
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
    return new Response(
      JSON.stringify({ error: 'Failed to process avatar image', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}