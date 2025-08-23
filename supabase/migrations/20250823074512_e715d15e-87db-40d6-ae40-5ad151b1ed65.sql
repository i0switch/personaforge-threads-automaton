-- ryuji56460121@yahoo.co.jp アカウントの復活
-- プロフィールデータを作成（存在しない場合のみ）
INSERT INTO public.profiles (user_id, display_name, created_at, updated_at)
SELECT 'bffaecca-2730-408a-bfd8-563f3d75d6e8', 'ryuji56460121', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = 'bffaecca-2730-408a-bfd8-563f3d75d6e8'
);

-- アカウント状態データを作成（存在しない場合のみ）
INSERT INTO public.user_account_status (user_id, is_active, is_approved, persona_limit, created_at, updated_at)
SELECT 'bffaecca-2730-408a-bfd8-563f3d75d6e8', true, true, 1, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_account_status 
  WHERE user_id = 'bffaecca-2730-408a-bfd8-563f3d75d6e8'
);

-- もし既に存在する場合は、アクティブ状態を復活
UPDATE public.user_account_status 
SET is_active = true, is_approved = true, updated_at = now()
WHERE user_id = 'bffaecca-2730-408a-bfd8-563f3d75d6e8';

-- セキュリティログに復活処理を記録
INSERT INTO public.security_events (event_type, user_id, details, created_at)
VALUES (
  'account_restored',
  'bffaecca-2730-408a-bfd8-563f3d75d6e8',
  jsonb_build_object(
    'email', 'ryuji56460121@yahoo.co.jp',
    'restored_by', 'admin_action',
    'timestamp', now()
  ),
  now()
);