-- 全アクティブペルソナにリプライ監視設定を追加
INSERT INTO public.reply_check_settings (user_id, persona_id, check_interval_minutes, is_active, created_at, updated_at)
SELECT 
  p.user_id,
  p.id,
  5, -- 5分間隔
  true, -- アクティブ
  now(),
  now()
FROM personas p
WHERE p.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM reply_check_settings rcs 
  WHERE rcs.persona_id = p.id
);

-- threads-auto-replyエッジファンクション用のデータベース関数を作成
CREATE OR REPLACE FUNCTION public.get_persona_for_auto_reply(persona_id_param uuid)
RETURNS TABLE(
  id uuid,
  name text,
  user_id uuid,
  ai_auto_reply_enabled boolean,
  threads_access_token text,
  auto_reply_settings jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.user_id,
    p.ai_auto_reply_enabled,
    p.threads_access_token,
    jsonb_build_object(
      'response_template', ar.response_template,
      'delay_minutes', ar.delay_minutes,
      'trigger_keywords', ar.trigger_keywords,
      'is_active', ar.is_active
    ) as auto_reply_settings
  FROM personas p
  LEFT JOIN auto_replies ar ON p.id = ar.persona_id AND ar.is_active = true
  WHERE p.id = persona_id_param
  AND p.is_active = true;
END;
$$;