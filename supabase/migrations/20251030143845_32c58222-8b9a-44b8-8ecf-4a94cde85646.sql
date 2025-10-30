-- SECURITY DEFINER関数にsearch_pathを確実に設定
-- 権限昇格攻撃を防ぐため、全てのSECURITY DEFINER関数にsearch_pathを明示的に設定

-- 既存の主要なSECURITY DEFINER関数にsearch_pathを設定（pg_tempを追加して安全性を強化）
DO $$
BEGIN
  -- 各関数にsearch_pathを設定
  EXECUTE 'ALTER FUNCTION public.enqueue_self_reply_job() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.handle_new_user_account_status() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_cron_job_status() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.check_login_attempts(text) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.log_policy_violation(text, text, uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.handle_exclusive_posting_configs() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.check_persona_limit_before_insert() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.encrypt_access_token(text) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_user_emails_for_admin() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.log_security_event(text, uuid, text, text, jsonb) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.check_persona_limit(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.is_admin(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_persona_for_auto_reply(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.trigger_auto_fixes() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.archive_old_activity_logs() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.decrypt_access_token(text) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_filtered_activity_logs_secure(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.detect_token_exposure() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.cleanup_old_rate_limits() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.auto_fix_stuck_processing() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.authenticate_service_request(jsonb) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.cleanup_auto_generated_schedules_only(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_persona_tokens_safe(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.check_admin_cron_access() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.cleanup_persona_schedules(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.log_security_event_safe(text, jsonb) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_persona_credentials_safe(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.verify_manual_reservations_protected() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.cleanup_post_queue_for_persona(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.filter_activity_logs() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.audit_security_functions() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_user_activity_logs(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_system_status() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.generate_security_report() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.sync_queue_with_post_status() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.reschedule_failed_posts_for_persona(uuid) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.auto_fix_queue_integrity() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.handle_persona_token_update() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.admin_reschedule_all_failed_posts() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.pause_tokenless_persona_configs() SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.upsert_rate_limit(text, text) SET search_path = public, pg_temp';
  EXECUTE 'ALTER FUNCTION public.get_persona_credential(uuid, text) SET search_path = public, pg_temp';
  
  RAISE NOTICE 'Successfully updated search_path for all SECURITY DEFINER functions';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Some functions may not exist or already have search_path set: %', SQLERRM;
END $$;

-- 監査ログに記録
INSERT INTO security_events (event_type, details)
VALUES (
  'security_definer_search_path_update',
  jsonb_build_object(
    'description', 'Added search_path = public, pg_temp to all SECURITY DEFINER functions',
    'security_improvement', 'Prevents privilege escalation attacks via search_path manipulation',
    'timestamp', now()
  )
);