-- ユーザーアカウント状態にセキュリティ移行通知フラグを追加
ALTER TABLE public.user_account_status 
ADD COLUMN security_migration_notified boolean DEFAULT false;