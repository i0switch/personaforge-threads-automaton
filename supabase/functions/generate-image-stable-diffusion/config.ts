import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const defaultValues = {
  negative_prompt: "cartoon, 3d, (disfigured), (bad art), (deformed), (poorly drawn), (extra limbs), strange colors, blurry",
  ip_adapter_scale: 1.0,
  guidance_scale: 7.5,
  num_inference_steps: 30,
  width: 512,
  height: 768,
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
export const supabase = createClient(supabaseUrl, supabaseServiceKey)