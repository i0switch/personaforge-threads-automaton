
-- ユーザーロール用のenumを作成
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ユーザーロールテーブルを作成
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- アカウント状態管理テーブルを作成
CREATE TABLE public.user_account_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  subscription_status TEXT DEFAULT 'free',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLSを有効化
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_account_status ENABLE ROW LEVEL SECURITY;

-- ロールチェック用のセキュリティ関数
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 管理者チェック用の関数
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- user_rolesのRLSポリシー
CREATE POLICY "Users can view their own roles" 
ON public.user_roles FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" 
ON public.user_roles FOR SELECT 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles" 
ON public.user_roles FOR ALL 
USING (public.is_admin(auth.uid()));

-- user_account_statusのRLSポリシー
CREATE POLICY "Users can view their own account status" 
ON public.user_account_status FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all account statuses" 
ON public.user_account_status FOR SELECT 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage account statuses" 
ON public.user_account_status FOR ALL 
USING (public.is_admin(auth.uid()));

-- 新規ユーザー登録時にアカウント状態を自動作成する関数
CREATE OR REPLACE FUNCTION public.handle_new_user_account_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_account_status (user_id, is_active, is_approved)
  VALUES (NEW.id, false, false);
  RETURN NEW;
END;
$$;

-- 新規ユーザー登録時のトリガー（既存のhandle_new_user関数を更新）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- updated_atの自動更新トリガー
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_account_status_updated_at
  BEFORE UPDATE ON public.user_account_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
