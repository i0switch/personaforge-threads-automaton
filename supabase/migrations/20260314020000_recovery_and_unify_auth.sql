-- ==========================================
-- RECOVERY & AUTH UNIFICATION SQL (20260314)
-- ==========================================

-- 1. [RECOVERY] auto_post_configs カラム不整合の解消
ALTER TABLE public.auto_post_configs
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- 2. [AUTH] pg_cron ジョブの認証方式統一 (x-cron-secret への移行)
-- app.settings.cron_secret を使用するように変更（ALTER DATABASE SET で永続化を推奨）。

-- 既存ジョブのクリーンアップ
DO $$ BEGIN PERFORM cron.unschedule('auto-scheduler-job'); EXCEPTION WHEN OTHERS THEN END $$;
DO $$ BEGIN PERFORM cron.unschedule('check-replies-every-5-minutes'); EXCEPTION WHEN OTHERS THEN END $$;

-- auto-scheduler-job の再登録 (x-cron-secret 方式)
SELECT cron.schedule(
  'auto-scheduler-job',
  '*/5 * * * *',
  $$
    SELECT
      net.http_post(
        url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-scheduler',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', COALESCE(current_setting('app.settings.cron_secret', true), 'DUMMY_SECRET_CHANGE_ME')
        ),
        body := jsonb_build_object('scheduled_execution', true, 'timestamp', now())
      );
  $$
);

-- check-replies ジョブの再登録 (x-cron-secret 方式)
SELECT cron.schedule(
  'check-replies-every-5-minutes',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/check-replies',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE(current_setting('app.settings.cron_secret', true), 'DUMMY_SECRET_CHANGE_ME')
      ),
      body := jsonb_build_object('scheduled', true)
    );
  $$
);

-- 3. [VIEW] cronジョブ状態確認用ビューの更新
CREATE OR REPLACE VIEW cron_job_status AS
SELECT jobname, schedule, active, jobid FROM cron.job;
