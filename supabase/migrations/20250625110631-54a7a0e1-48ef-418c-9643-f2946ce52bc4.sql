
-- RLSポリシーの再作成（リアルタイムロール用のポリシーを除く）
-- user_account_statusテーブルのポリシー
DROP POLICY IF EXISTS "Users can view their own account status" ON public.user_account_status;
DROP POLICY IF EXISTS "Admins can view all account statuses" ON public.user_account_status;
DROP POLICY IF EXISTS "Admins can manage account statuses" ON public.user_account_status;

-- profilesテーブルのポリシー
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 新しいポリシーを作成（リアルタイムロール用を除く）
CREATE POLICY "Users can view their own account status" 
ON public.user_account_status FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all account statuses" 
ON public.user_account_status FOR SELECT 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage account statuses" 
ON public.user_account_status FOR ALL 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own profiles" 
ON public.profiles FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.is_admin(auth.uid()));

-- リアルタイムパブリケーションとREPLICA IDENTITY設定
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_account_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER TABLE public.user_account_status REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
