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

    // First, find all active auto_post_configs
    const { data: activeConfigs, error: configError } = await supabaseAdmin
      .from('auto_post_configs')
      .select('persona_id')
      .eq('is_active', true);

    if (configError) {
      console.error('❌ Error fetching active configs:', configError);
      throw configError;
    }

    if (!activeConfigs || activeConfigs.length === 0) {
      console.log('✅ No active configs found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active configs found',
          activated: 0
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        }
      );
    }

    const activePersonaIds = activeConfigs.map(config => config.persona_id);
    console.log(`📋 Found ${activePersonaIds.length} active configs for personas:`, activePersonaIds);

    // Find inactive personas that have active configs
    const { data: inactivePersonas, error: fetchError } = await supabaseAdmin
      .from('personas')
      .select('id, name, is_active')
      .eq('is_active', false)
      .in('id', activePersonaIds);

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
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const nextRunTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
    
    console.log(`🕐 Updating next_run_at for personas: ${personaIds.join(', ')}`);
    console.log(`🕐 Cutoff time: ${cutoffTime}, New next_run_at: ${nextRunTime}`);
    
    const { data: updatedConfigs, error: configUpdateError } = await supabaseAdmin
      .from('auto_post_configs')
      .update({ 
        next_run_at: nextRunTime
      })
      .in('persona_id', personaIds)
      .lt('next_run_at', cutoffTime)
      .select('persona_id, next_run_at');

    if (configUpdateError) {
      console.warn('⚠️ Error updating next_run_at:', configUpdateError);
    } else {
      console.log(`🕐 Updated next_run_at for ${updatedConfigs?.length || 0} configs`);
      if (updatedConfigs && updatedConfigs.length > 0) {
        console.log('Updated configs:', updatedConfigs);
      }
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
        error: error instanceof Error ? error.message : String(error),
        activated: 0
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});