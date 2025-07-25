-- Fix get_persona_for_auto_reply function to use correct auto_replies table structure
DROP FUNCTION IF EXISTS public.get_persona_for_auto_reply(uuid);

CREATE OR REPLACE FUNCTION public.get_persona_for_auto_reply(persona_id_param uuid)
 RETURNS TABLE(id uuid, name text, user_id uuid, ai_auto_reply_enabled boolean, threads_access_token text, auto_replies jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.user_id,
    p.ai_auto_reply_enabled,
    p.threads_access_token,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ar.id,
          'response_template', ar.response_template,
          'delay_minutes', ar.delay_minutes,
          'trigger_keywords', ar.trigger_keywords,
          'is_active', ar.is_active
        )
      ) FILTER (WHERE ar.id IS NOT NULL), 
      '[]'::jsonb
    ) as auto_replies
  FROM personas p
  LEFT JOIN auto_replies ar ON p.id = ar.persona_id AND ar.is_active = true
  WHERE p.id = persona_id_param
  AND p.is_active = true
  GROUP BY p.id, p.name, p.user_id, p.ai_auto_reply_enabled, p.threads_access_token;
END;
$function$;