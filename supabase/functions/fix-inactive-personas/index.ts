import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔧 Starting persona activation fix...');

    // Find personas that have active auto_post_configs but are inactive
    const { data: inactivePersonas, error: fetchError } = await supabaseAdmin
      .from('personas')
      .select(`
        id, name, is_active,
        auto_post_configs!inner(id, is_active)
      `)
      .eq('is_active', false)
      .eq('auto_post_configs.is_active', true);

    if (fetchError) {
      console.error('❌ Error fetching inactive personas:', fetchError);
      throw fetchError;
    }

    if (!inactivePersonas || inactivePersonas.length === 0) {
      console.log('✅ No inactive personas found - all good!');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No inactive personas found',
          activated: 0
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        }
      );
    }

    console.log(`📋 Found ${inactivePersonas.length} inactive personas to activate`);

    // Activate the personas
    const personaIds = inactivePersonas.map(p => p.id);
    const { data: updatedPersonas, error: updateError } = await supabaseAdmin
      .from('personas')
      .update({ is_active: true })
      .in('id', personaIds)
      .select('id, name');

    if (updateError) {
      console.error('❌ Error activating personas:', updateError);
      throw updateError;
    }

    console.log(`✅ Successfully activated ${updatedPersonas?.length || 0} personas`);
    
    // Also fix any stale next_run_at timestamps in auto_post_configs
    const { error: configUpdateError } = await supabaseAdmin
      .from('auto_post_configs')
      .update({ 
        next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
      })
      .in('persona_id', personaIds)
      .lt('next_run_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // older than 1 hour

    if (configUpdateError) {
      console.warn('⚠️ Error updating next_run_at:', configUpdateError);
    } else {
      console.log('🕐 Updated next_run_at for activated personas');
    }

    // Log security event
    await supabaseAdmin
      .from('security_events')
      .insert({
        event_type: 'persona_activation_fix',
        details: {
          activated_personas: updatedPersonas?.length || 0,
          persona_names: updatedPersonas?.map(p => p.name) || [],
          timestamp: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully activated ${updatedPersonas?.length || 0} personas`,
        activated: updatedPersonas?.length || 0,
        personas: updatedPersonas
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in fix-inactive-personas:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        activated: 0
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});