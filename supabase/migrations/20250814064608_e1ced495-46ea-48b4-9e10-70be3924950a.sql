-- Add updated_at automatic update triggers for all tables with updated_at column
-- Uses existing function public.update_updated_at_column()

-- Helper to create trigger if it doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_post_configs_updated_at'
  ) THEN
    CREATE TRIGGER trg_auto_post_configs_updated_at
    BEFORE UPDATE ON public.auto_post_configs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_replies_updated_at'
  ) THEN
    CREATE TRIGGER trg_auto_replies_updated_at
    BEFORE UPDATE ON public.auto_replies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_webhook_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_webhook_settings_updated_at
    BEFORE UPDATE ON public.webhook_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_personas_updated_at'
  ) THEN
    CREATE TRIGGER trg_personas_updated_at
    BEFORE UPDATE ON public.personas
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_self_reply_jobs_updated_at'
  ) THEN
    CREATE TRIGGER trg_self_reply_jobs_updated_at
    BEFORE UPDATE ON public.self_reply_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_security_config_updated_at'
  ) THEN
    CREATE TRIGGER trg_security_config_updated_at
    BEFORE UPDATE ON public.security_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_post_queue_updated_at'
  ) THEN
    CREATE TRIGGER trg_post_queue_updated_at
    BEFORE UPDATE ON public.post_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_thread_replies_updated_at'
  ) THEN
    CREATE TRIGGER trg_thread_replies_updated_at
    BEFORE UPDATE ON public.thread_replies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_scheduling_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_scheduling_settings_updated_at
    BEFORE UPDATE ON public.scheduling_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_self_reply_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_self_reply_settings_updated_at
    BEFORE UPDATE ON public.self_reply_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_posts_updated_at'
  ) THEN
    CREATE TRIGGER trg_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_roles_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_analytics_updated_at'
  ) THEN
    CREATE TRIGGER trg_analytics_updated_at
    BEFORE UPDATE ON public.analytics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reply_check_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_reply_check_settings_updated_at
    BEFORE UPDATE ON public.reply_check_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_account_status_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_account_status_updated_at
    BEFORE UPDATE ON public.user_account_status
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;