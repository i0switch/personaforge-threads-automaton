-- 不整合を防ぐためのロジック強化

-- 1. ペルソナの投稿設定切り替え時に既存のスケジュールとキューを自動清掃する関数
CREATE OR REPLACE FUNCTION public.cleanup_persona_schedules(p_persona_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- スケジュール済み/下書きの投稿を下書き状態にリセット
  UPDATE posts 
  SET status = 'draft',
      scheduled_for = NULL,
      retry_count = 0,
      last_retry_at = NULL,
      updated_at = now()
  WHERE persona_id = p_persona_id 
    AND status IN ('scheduled')
    AND published_at IS NULL;

  -- キューからも削除
  DELETE FROM post_queue 
  WHERE post_id IN (
    SELECT p.id 
    FROM posts p 
    WHERE p.persona_id = p_persona_id
  )
  AND status IN ('queued', 'pending');

  -- アクティブログに記録
  INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
  SELECT 
    p.user_id, 
    p_persona_id, 
    'schedule_cleanup',
    'Cleaned up schedules due to posting mode change',
    jsonb_build_object(
      'cleaned_posts', (
        SELECT COUNT(*) FROM posts 
        WHERE persona_id = p_persona_id AND status = 'draft' AND scheduled_for IS NULL
      ),
      'timestamp', now()
    )
  FROM personas p 
  WHERE p.id = p_persona_id
  LIMIT 1;
END;
$function$;

-- 2. 排他制御トリガーを強化（既存の関数を更新）
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
    
    -- スケジュールとキューを清掃
    PERFORM cleanup_persona_schedules(NEW.persona_id);
    
    RAISE NOTICE 'ランダムポスト設定アクティブ化: ペルソナ % のオートポスト設定を非アクティブにし、スケジュールを清掃しました', NEW.persona_id;
  END IF;
  
  -- オートポスト設定がアクティブになる場合
  IF TG_TABLE_NAME = 'auto_post_configs' AND NEW.is_active = true THEN
    -- 同じペルソナのランダムポスト設定を非アクティブに
    UPDATE random_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    -- スケジュールとキューを清掃
    PERFORM cleanup_persona_schedules(NEW.persona_id);
    
    RAISE NOTICE 'オートポスト設定アクティブ化: ペルソナ % のランダムポスト設定を非アクティブにし、スケジュールを清掃しました', NEW.persona_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. トリガーが存在しない場合は作成
DO $$ 
BEGIN
  -- auto_post_configs テーブル用トリガー
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'handle_exclusive_posting_configs_auto' 
    AND tgrelid = 'auto_post_configs'::regclass
  ) THEN
    CREATE TRIGGER handle_exclusive_posting_configs_auto
      AFTER INSERT OR UPDATE ON auto_post_configs
      FOR EACH ROW EXECUTE FUNCTION handle_exclusive_posting_configs();
  END IF;

  -- random_post_configs テーブル用トリガー  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'handle_exclusive_posting_configs_random'
    AND tgrelid = 'random_post_configs'::regclass
  ) THEN
    CREATE TRIGGER handle_exclusive_posting_configs_random
      AFTER INSERT OR UPDATE ON random_post_configs
      FOR EACH ROW EXECUTE FUNCTION handle_exclusive_posting_configs();
  END IF;
END $$;