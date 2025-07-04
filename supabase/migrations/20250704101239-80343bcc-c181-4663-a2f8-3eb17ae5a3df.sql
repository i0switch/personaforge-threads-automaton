-- 既存の関数を削除
DROP FUNCTION IF EXISTS public.get_user_emails_for_admin();

-- 修正した関数を再作成
CREATE OR REPLACE FUNCTION public.get_user_emails_for_admin()
RETURNS TABLE(user_id uuid, email character varying(255))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to execute this function
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  RETURN QUERY
  SELECT au.id, au.email
  FROM auth.users au;
END;
$$;