-- 新規ユーザー作成時のトリガーを設定
-- handle_new_user関数は既に存在するので、トリガーのみ作成

-- トリガーを作成（auth.usersテーブルに新しいユーザーが追加された時に実行）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 既存のhandle_new_user_account_status関数も念のため確認して、必要であれば更新
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- プロフィール作成
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  
  -- アカウント状態作成（デフォルトでpersona_limit = 1）
  INSERT INTO public.user_account_status (user_id, is_active, is_approved, persona_limit)
  VALUES (NEW.id, false, false, 1);
  
  RETURN NEW;
END;
$$;