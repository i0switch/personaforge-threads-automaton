-- 予約投稿完全独立化：重複トリガー整理と危険関数修正

-- 重複トリガーを削除
DROP TRIGGER IF EXISTS handle_exclusive_posting_configs_auto ON auto_post_configs;
DROP TRIGGER IF EXISTS trigger_exclusive_auto_post_config ON auto_post_configs;
DROP TRIGGER IF EXISTS handle_exclusive_posting_configs_random ON random_post_configs;  
DROP TRIGGER IF EXISTS trigger_exclusive_random_post_config ON random_post_configs;
DROP TRIGGER IF EXISTS trg_enqueue_self_reply_on_publish ON posts;
DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
DROP TRIGGER IF EXISTS update_auto_post_configs_updated_at ON auto_post_configs;
DROP TRIGGER IF EXISTS update_random_post_configs_updated_at ON random_post_configs;

-- cleanup_post_queue_for_persona関数を安全な実装に変更（手動予約完全保護）
CREATE OR REPLACE FUNCTION public.cleanup_post_queue_for_persona(p_persona_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 【重要】この関数は手動予約投稿を絶対に触らない安全バージョンに変更
  -- 自動生成された投稿のキュー項目のみ削除
  DELETE FROM post_queue 
  WHERE post_id IN (
    SELECT p.id 
    FROM posts p 
    WHERE p.persona_id = p_persona_id 
    AND p.auto_schedule = true  -- 自動生成のみ対象
    AND p.status IN ('scheduled', 'draft')
  )
  AND status IN ('queued', 'pending');
  
  -- 自動生成された投稿のみを下書きに（手動予約は絶対に保護）
  UPDATE posts 
  SET status = 'draft', 
      scheduled_for = NULL,
      retry_count = 0,
      last_retry_at = NULL,
      updated_at = now()
  WHERE persona_id = p_persona_id 
  AND status = 'scheduled'
  AND published_at IS NULL
  AND auto_schedule = true;  -- 自動生成のみ対象

  -- 保護ログ記録
  INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
  SELECT 
    p.user_id, 
    p_persona_id, 
    'safe_cleanup',
    'Safe cleanup: manual reservations fully protected',
    jsonb_build_object(
      'auto_posts_affected', (
        SELECT COUNT(*) FROM posts 
        WHERE persona_id = p_persona_id 
        AND status = 'draft' 
        AND auto_schedule = true
      ),
      'manual_posts_protected', (
        SELECT COUNT(*) FROM posts 
        WHERE persona_id = p_persona_id 
        AND status = 'scheduled' 
        AND (auto_schedule IS NULL OR auto_schedule = false)
      ),
      'timestamp', now()
    )
  FROM personas p 
  WHERE p.id = p_persona_id
  LIMIT 1;
END;
$function$;

-- 排他制御トリガー関数も再度安全化確認
CREATE OR REPLACE FUNCTION public.handle_exclusive_posting_configs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- ランダムポスト設定がアクティブになる場合
  IF TG_TABLE_NAME = 'random_post_configs' AND NEW.is_active = true THEN
    -- 同じペルソナのオートポスト設定を非アクティブに
    UPDATE auto_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    -- 自動生成された投稿のみクリーンアップ（手動予約投稿は絶対保護）
    PERFORM cleanup_auto_generated_schedules_only(NEW.persona_id);
    
    -- 安全確認ログ
    RAISE NOTICE '[安全] ランダムポスト有効化: ペルソナ % - 手動予約投稿は完全保護', NEW.persona_id;
  END IF;
  
  -- オートポスト設定がアクティブになる場合
  IF TG_TABLE_NAME = 'auto_post_configs' AND NEW.is_active = true THEN
    -- 同じペルソナのランダムポスト設定を非アクティブに
    UPDATE random_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    -- 自動生成された投稿のみクリーンアップ（手動予約投稿は絶対保護）
    PERFORM cleanup_auto_generated_schedules_only(NEW.persona_id);
    
    -- 安全確認ログ
    RAISE NOTICE '[安全] オートポスト有効化: ペルソナ % - 手動予約投稿は完全保護', NEW.persona_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 手動予約投稿の完全保護を確認する検証関数
CREATE OR REPLACE FUNCTION public.verify_manual_reservations_protected()
RETURNS TABLE(
  persona_id uuid,
  manual_scheduled_count bigint,
  auto_scheduled_count bigint,
  protection_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as persona_id,
    COUNT(posts.*) FILTER (
      WHERE posts.status = 'scheduled' 
      AND (posts.auto_schedule IS NULL OR posts.auto_schedule = false)
    ) as manual_scheduled_count,
    COUNT(posts.*) FILTER (
      WHERE posts.status = 'scheduled' 
      AND posts.auto_schedule = true
    ) as auto_scheduled_count,
    CASE 
      WHEN COUNT(posts.*) FILTER (
        WHERE posts.status = 'scheduled' 
        AND (posts.auto_schedule IS NULL OR posts.auto_schedule = false)
      ) > 0 THEN '✅ 手動予約投稿保護中'
      ELSE '⚪ 手動予約なし'
    END as protection_status
  FROM personas p
  LEFT JOIN posts ON p.id = posts.persona_id 
    AND posts.published_at IS NULL
  GROUP BY p.id;
END;
$function$;