-- 既存のペルソナでAI自動返信または定型文返信がONだが、reply_check_settingsがないものに対して設定を作成
INSERT INTO public.reply_check_settings (user_id, persona_id, check_interval_minutes, is_active, created_at, updated_at)
SELECT 
  p.user_id,
  p.id as persona_id,
  5 as check_interval_minutes,
  true as is_active,
  now() as created_at,
  now() as updated_at
FROM public.personas p
WHERE (p.ai_auto_reply_enabled = true OR p.auto_reply_enabled = true)
AND p.is_active = true
AND NOT EXISTS (
  SELECT 1 
  FROM public.reply_check_settings rcs 
  WHERE rcs.persona_id = p.id
);