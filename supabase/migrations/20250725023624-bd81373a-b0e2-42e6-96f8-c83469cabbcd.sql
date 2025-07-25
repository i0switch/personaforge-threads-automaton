-- kic52977@gmail.comのペルソナのリプライ監視設定を追加

INSERT INTO public.reply_check_settings (user_id, persona_id, check_interval_minutes, is_active)
SELECT 
  p.user_id,
  p.id,
  5,
  true
FROM personas p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'kic52977@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM reply_check_settings rcs 
  WHERE rcs.persona_id = p.id
);