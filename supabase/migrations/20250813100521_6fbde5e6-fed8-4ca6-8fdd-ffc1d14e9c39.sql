-- Fix linter WARN 1: Ensure function search_path is set for SECURITY DEFINER function
CREATE OR REPLACE FUNCTION log_policy_violation(
  table_name text,
  operation text,
  user_id_attempted uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM log_security_event(
    'policy_violation',
    auth.uid(),
    NULL,
    NULL,
    jsonb_build_object(
      'table', table_name,
      'operation', operation,
      'attempted_user_id', user_id_attempted,
      'timestamp', now()
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;