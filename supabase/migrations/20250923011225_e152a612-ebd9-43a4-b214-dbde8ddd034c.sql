-- Step 1: 重複トリガーを削除
DROP TRIGGER IF EXISTS trg_prevent_draft_posts ON public.posts;
DROP TRIGGER IF EXISTS prevent_draft_posts_trigger ON public.posts;

-- Step 2: prevent_draft_posts関数を修正（自動投稿を除外）
CREATE OR REPLACE FUNCTION public.prevent_draft_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  bypass text;
  bypass_on boolean := false;
BEGIN
  -- ローカルセッションGUCによる例外フラグ
  bypass := current_setting('app.bypass_draft_check', true);
  IF bypass IS NOT NULL AND lower(bypass) IN ('on', 'true', '1') THEN
    bypass_on := true;
  END IF;

  -- 自動投稿（auto_schedule=true）は常に許可
  IF NEW.auto_schedule = true THEN
    RETURN NEW;
  END IF;

  -- draft投稿の禁止（手動投稿のみ）
  IF NEW.status = 'draft' AND NOT bypass_on THEN
    RAISE EXCEPTION 'Draft posts are no longer allowed. All posts must be scheduled.';
  END IF;

  -- scheduledのときはscheduled_for必須
  IF NEW.status = 'scheduled' AND NEW.scheduled_for IS NULL THEN
    RAISE EXCEPTION 'Scheduled posts must have a scheduled_for timestamp.';
  END IF;

  RETURN NEW;
END;
$function$;

-- Step 3: 修正されたトリガーを再作成
CREATE TRIGGER prevent_draft_posts_trigger 
  BEFORE INSERT OR UPDATE ON public.posts 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_draft_posts();

-- Step 4: 無効化された自動投稿を復旧
UPDATE public.posts 
SET 
  status = 'scheduled',
  scheduled_for = created_at + INTERVAL '1 hour',
  updated_at = now()
WHERE 
  auto_schedule = true 
  AND status = 'draft' 
  AND created_at >= '2025-09-23 00:00:00'
  AND published_at IS NULL;

-- Step 5: 復旧された投稿をpost_queueに追加
INSERT INTO public.post_queue (user_id, post_id, scheduled_for, status)
SELECT 
  user_id, 
  id, 
  scheduled_for,
  'queued'
FROM public.posts 
WHERE 
  auto_schedule = true 
  AND status = 'scheduled' 
  AND created_at >= '2025-09-23 00:00:00'
  AND published_at IS NULL
ON CONFLICT (post_id) DO NOTHING;