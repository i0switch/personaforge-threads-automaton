-- ==========================================
-- RECOVERY & AUTH UNIFICATION SQL (20260314)
-- ==========================================

-- 1. [RECOVERY] auto_post_configs カラム不整合の解消
-- 20260314011311 相当の内容だが、確実に実行するために IF NOT EXISTS 付きで実行
ALTER TABLE public.auto_post_configs
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- 2. [AUTH] pg_cron ジョブの認証方式統一 (x-cron-secret への移行)
-- app.settings.cron_secret を使用するように変更。
-- これにより service_role_key を DB に保存する必要がなくなる。

-- 既存ジョブのクリーンアップ
SELECT cron.unschedule('auto-scheduler-job');
SELECT cron.unschedule('check-replies-every-5-minutes');

-- auto-scheduler-job の再登録 (x-cron-secret 方式)
-- 注: 事前に Supabase DashBoard の Edge Function Secrets に CRON_SECRET を設定し、
-- DB側で SELECT set_config('app.settings.cron_secret', 'your_secret', false); を実行することを推奨。
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
SELECT 
  jobname,
  schedule,
  active,
  jobid
FROM cron.job;
