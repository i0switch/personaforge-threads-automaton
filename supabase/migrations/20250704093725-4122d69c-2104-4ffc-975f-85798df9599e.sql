-- RLS policy for user deletion
CREATE POLICY "Admins can delete user profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Function to get user emails for admin (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_user_emails_for_admin()
RETURNS TABLE(user_id uuid, email text)
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