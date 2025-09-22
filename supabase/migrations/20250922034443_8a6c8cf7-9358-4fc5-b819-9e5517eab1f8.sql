-- Fix get_user_emails_for_admin function with proper admin access
CREATE OR REPLACE FUNCTION public.get_user_emails_for_admin()
RETURNS TABLE(user_id uuid, email character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Allow service role or check admin status for authenticated users
  IF current_setting('role'::text, true) = 'service_role'::text THEN
    -- Service role has full access
    NULL;
  ELSIF current_user_id IS NOT NULL THEN
    -- Check if authenticated user is admin
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = current_user_id AND ur.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;
  
  RETURN QUERY
  SELECT au.id, au.email
  FROM auth.users au;
END;
$$;