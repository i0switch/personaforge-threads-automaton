# Supabase Live 復旧ランブック (2026-03-14 更新)

## 現狀の調査結果 (Live実測済み)
- **Edge Functions Secrets**: `CRON_SECRET` が未設定であり、認証失敗の主因となっていた。`ENCRYPTION_KEY` は2025/07に設定済みであることを確認。
- **pg_cron**: 旧方式（Authorization Bearer）のジョブが残存、または機密情報不備により `auto-scheduler` が正常に動作していない。
- **DB Schema**: `auto_post_configs` に `processing_status` 等のカラムが不足している。

## 復旧手順

### 1. 共有シークレットの設定 (実施済み)
Edge Function 側に以下を設定済み：
- `CRON_SECRET`: (設定済み)
※ `ENCRYPTION_KEY` は既存値を維持。

### 2. データベースの修復 (SQL Editor で実行)
以下の統合リカバリスクリプトの内容を、Supabase Dashboard の **SQL Editor** で実行してください。
これにより、カラムの追加、旧ジョブの削除、および `x-cron-secret` 方式での再登録が一括して行われます。

```sql
-- [1] カラム不足の解消
ALTER TABLE public.auto_post_configs
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- [2] ジョブ再登録 (x-cron-secret 方式)
-- 既存のジョブをクリーンアップ
DO $$ BEGIN PERFORM cron.unschedule('auto-scheduler-job'); EXCEPTION WHEN OTHERS THEN END $$;
DO $$ BEGIN PERFORM cron.unschedule('check-replies-every-5-minutes'); EXCEPTION WHEN OTHERS THEN END $$;

-- 新ジョブ登録
-- 注意: 'YOUR_CRON_SECRET' は Edge Functions Secrets に設定した共有秘密鍵に置き換えてください
SELECT cron.schedule('auto-scheduler-job', '*/5 * * * *',
  $$ SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-scheduler',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := jsonb_build_object('scheduled_execution', true, 'timestamp', now())
  ); $$
);

SELECT cron.schedule('check-replies-every-5-minutes', '*/5 * * * *',
  $$ SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/check-replies',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := jsonb_build_object('scheduled', true)
  ); $$
);

-- [3] 確認ビューの作成
CREATE OR REPLACE VIEW cron_job_status AS
SELECT jobname, schedule, active, jobid FROM cron.job;
```

### 3. Edge Functions のデプロイ
最新の `auto-scheduler`, `auto-post-generator`, `retrieve-secret` をデプロイしてください。

## 正常稼働の確認
- `cron_job_status` ビューでジョブが `active` であること。
- Edge Function のログで `✅ Internal auth success via x-cron-secret` が出力されていることを確認。
