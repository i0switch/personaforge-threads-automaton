-- 問題のあるユーザーのプロフィールとアカウント状態を手動で作成
INSERT INTO public.profiles (user_id, display_name)
VALUES ('a112f3e5-f697-4a39-afc5-7ef5eb9107a2', null)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_account_status (user_id, is_active, is_approved, persona_limit)
VALUES ('a112f3e5-f697-4a39-afc5-7ef5eb9107a2', false, false, 1)
ON CONFLICT (user_id) DO NOTHING;