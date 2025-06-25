
-- 特定のユーザーIDを使って管理者アカウントを有効化
UPDATE public.user_account_status 
SET is_active = true, is_approved = true, approved_at = now()
WHERE user_id = 'c3107a73-32d8-4b92-9867-e7d876333009';

-- 管理者ロールを設定（存在しない場合のみ）
INSERT INTO public.user_roles (user_id, role)
SELECT 'c3107a73-32d8-4b92-9867-e7d876333009'::uuid, 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = 'c3107a73-32d8-4b92-9867-e7d876333009' AND role = 'admin'
);

-- アカウント状態レコードが存在しない場合は作成
INSERT INTO public.user_account_status (user_id, is_active, is_approved, subscription_status, approved_at)
SELECT 'c3107a73-32d8-4b92-9867-e7d876333009'::uuid, true, true, 'premium', now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_account_status 
  WHERE user_id = 'c3107a73-32d8-4b92-9867-e7d876333009'
);
