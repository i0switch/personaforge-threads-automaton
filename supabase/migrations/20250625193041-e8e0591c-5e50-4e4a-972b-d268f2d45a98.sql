
-- Database Functions のセキュリティ強化: search_path を明示的に設定
-- これにより SQL Injection 攻撃から保護されます

-- has_role 関数の修正
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- is_admin 関数の修正
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- handle_new_user_account_status 関数の修正
CREATE OR REPLACE FUNCTION public.handle_new_user_account_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_account_status (user_id, is_active, is_approved)
  VALUES (NEW.id, false, false);
  RETURN NEW;
END;
$$;

-- get_user_stats 関数の修正
CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS TABLE(
  total_users BIGINT, 
  approved_users BIGINT, 
  pending_users BIGINT, 
  active_subscriptions BIGINT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(p.user_id) AS total_users,
    COUNT(uas.user_id) FILTER (WHERE uas.is_approved = true) AS approved_users,
    COUNT(p.user_id) - COUNT(uas.user_id) FILTER (WHERE uas.is_approved = true) AS pending_users,
    COUNT(uas.user_id) FILTER (WHERE uas.subscription_status IS NOT NULL AND uas.subscription_status <> 'free') AS active_subscriptions
  FROM public.profiles p
  LEFT JOIN public.user_account_status uas ON p.user_id = uas.user_id;
END;
$$;

-- update_updated_at_column 関数の修正
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- handle_new_user 関数の修正
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- プロフィール作成
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  
  -- アカウント状態作成
  INSERT INTO public.user_account_status (user_id, is_active, is_approved)
  VALUES (NEW.id, false, false);
  
  RETURN NEW;
END;
$$;
