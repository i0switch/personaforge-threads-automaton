-- セキュリティ問題を修正：ビューにRLSポリシーを適用
DROP VIEW IF EXISTS public.filtered_activity_logs;

-- 通常のビューとしてRLSポリシー付きで再作成
CREATE VIEW public.filtered_activity_logs 
WITH (security_barrier = true) AS
SELECT 
  id,
  user_id,
  persona_id,
  action_type,
  description,
  metadata,
  created_at
FROM public.activity_logs
WHERE action_type NOT IN ('post_publish_failed', 'auto_schedule_cleanup', 'schedule_cleanup', 'safe_cleanup');

-- ビューにRLSを有効化
ALTER VIEW public.filtered_activity_logs SET (row_security = on);

-- ビューに適切なRLSポリシーを設定
CREATE POLICY "Users can view their own filtered activity logs" ON public.activity_logs
FOR SELECT USING (auth.uid() = user_id AND action_type NOT IN ('post_publish_failed', 'auto_schedule_cleanup', 'schedule_cleanup', 'safe_cleanup'));

CREATE POLICY "Admins can view all filtered activity logs" ON public.activity_logs
FOR SELECT USING (is_admin(auth.uid()) AND action_type NOT IN ('post_publish_failed', 'auto_schedule_cleanup', 'schedule_cleanup', 'safe_cleanup'));