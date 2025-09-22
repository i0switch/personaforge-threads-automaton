-- Fix get_user_emails_for_admin function to work properly
CREATE OR REPLACE FUNCTION public.get_user_emails_for_admin()
RETURNS TABLE(user_id uuid, email character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow service role or admin users to execute this function
  IF NOT (
    current_setting('role'::text, true) = 'service_role'::text OR 
    is_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  RETURN QUERY
  SELECT au.id, au.email
  FROM auth.users au;
END;
$$;