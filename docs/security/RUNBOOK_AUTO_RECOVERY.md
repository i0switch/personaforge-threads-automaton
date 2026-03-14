# 自動投稿・スケジューラー リカバリランブック (2026-03-14)

## 背景
`auto-scheduler` の認証不備、および `auto_post_configs` テーブルのスキーマ不整合（カラム欠損）により、現在自動投稿が停止しています。

## リカバリ手順

### 1. データベースの修正 (SQL Editorで実行)
`supabase/migrations/20260314020000_recovery_and_unify_auth.sql` の内容を SQL Editor で実行してください。
これにより以下の処理が行われます：
- 欠落している `processing_status` カラム等の追加
- `pg_cron` ジョブの認証方法を `x-cron-secret` 方式へ移行

### 2. 環境変数の設定 (Supabase Dashboard)
Edge Functions で使用するシークレットを設定してください。
- `CRON_SECRET`: 任意の共有シークレット文字列

### 3. DB側のシークレット反映 (SQL Editorで実行)
```sql
SELECT set_config('app.settings.cron_secret', '設定したシークレット文字列', false);
```

### 4. Edge Functions の再デプロイ
```bash
npx supabase functions deploy auto-scheduler
npx supabase functions deploy auto-post-generator
npx supabase functions deploy retrieve-secret
npx supabase functions deploy _shared
```

## 正常性の確認
- `cron_job_status` ビューでジョブが `active` であることを確認。
- Edge Function のログで `✅ Internal auth success via x-cron-secret` が出力されていることを確認。
