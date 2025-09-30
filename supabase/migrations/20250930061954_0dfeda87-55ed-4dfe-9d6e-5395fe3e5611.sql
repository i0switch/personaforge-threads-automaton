
-- thread_repliesの制約を修正：completedステータスを追加
ALTER TABLE thread_replies DROP CONSTRAINT IF EXISTS thread_replies_reply_status_check;
ALTER TABLE thread_replies ADD CONSTRAINT thread_replies_reply_status_check 
  CHECK (reply_status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'sent'::text, 'failed'::text, 'completed'::text]));

-- post_queueのステータスとpostsの整合性を取る関数を追加
CREATE OR REPLACE FUNCTION sync_queue_with_post_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- scheduledのpostでfailedキューのものをqueuedに戻す
  UPDATE post_queue pq
  SET status = 'queued', updated_at = now()
  FROM posts p
  WHERE pq.post_id = p.id
    AND p.status = 'scheduled'
    AND pq.status = 'failed';
    
  -- failedのpostでqueuedのものをfailedに
  UPDATE post_queue pq
  SET status = 'failed', updated_at = now()
  FROM posts p
  WHERE pq.post_id = p.id
    AND p.status = 'failed'
    AND pq.status IN ('queued', 'pending');
    
  -- publishedのpostでcompleted以外のものをcompletedに
  UPDATE post_queue pq
  SET status = 'completed', updated_at = now()
  FROM posts p
  WHERE pq.post_id = p.id
    AND p.status = 'published'
    AND pq.status != 'completed';
END;
$$;

-- 即座に同期を実行
SELECT sync_queue_with_post_status();

-- トークン未設定のペルソナの自動投稿設定を一時停止する関数
CREATE OR REPLACE FUNCTION pause_tokenless_persona_configs()
RETURNS TABLE(persona_name text, had_auto_post boolean, had_random_post boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH tokenless_personas AS (
    SELECT id, name
    FROM personas
    WHERE (threads_access_token IS NULL OR threads_access_token = '')
      AND is_active = true
  ),
  auto_updates AS (
    UPDATE auto_post_configs apc
    SET is_active = false, updated_at = now()
    FROM tokenless_personas tp
    WHERE apc.persona_id = tp.id AND apc.is_active = true
    RETURNING tp.name, true as had_auto
  ),
  random_updates AS (
    UPDATE random_post_configs rpc
    SET is_active = false, updated_at = now()
    FROM tokenless_personas tp
    WHERE rpc.persona_id = tp.id AND rpc.is_active = true
    RETURNING tp.name, true as had_random
  )
  SELECT 
    COALESCE(a.name, r.name) as persona_name,
    COALESCE(a.had_auto, false) as had_auto_post,
    COALESCE(r.had_random, false) as had_random_post
  FROM auto_updates a
  FULL OUTER JOIN random_updates r ON a.name = r.name;
END;
$$;

-- トークン未設定のペルソナの設定を一時停止
SELECT * FROM pause_tokenless_persona_configs();

-- 確認ログ
DO $$
DECLARE
  tokenless_count integer;
BEGIN
  SELECT COUNT(*) INTO tokenless_count
  FROM personas
  WHERE (threads_access_token IS NULL OR threads_access_token = '')
    AND is_active = true;
    
  RAISE NOTICE '✅ thread_repliesのステータス制約を修正（completedを追加）';
  RAISE NOTICE '✅ post_queueとpostsの整合性を同期';
  RAISE NOTICE '⚠️  トークン未設定のペルソナ: %件 - 自動投稿設定を一時停止', tokenless_count;
  RAISE NOTICE '💡 各ペルソナにThreadsアクセストークンを設定してください';
END $$;
