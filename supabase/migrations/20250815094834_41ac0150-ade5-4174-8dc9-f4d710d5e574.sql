-- 既存のauto_post_configsテーブルに複数時間設定用のカラムを追加
-- 既存機能は完全に残し、新機能として追加

-- 複数時間設定用のカラムを追加
ALTER TABLE auto_post_configs 
ADD COLUMN IF NOT EXISTS post_times time[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS multi_time_enabled boolean DEFAULT false;

-- 既存のpost_timeカラムは残し、下位互換性を保つ
COMMENT ON COLUMN auto_post_configs.post_time IS '従来の単一時間設定（下位互換性のため保持）';
COMMENT ON COLUMN auto_post_configs.post_times IS '複数時間設定（新機能）';
COMMENT ON COLUMN auto_post_configs.multi_time_enabled IS '複数時間設定が有効かどうか';

-- 次回実行時間計算のためのヘルパー関数を作成
CREATE OR REPLACE FUNCTION calculate_next_multi_time_run(
  p_current_time timestamptz,
  time_slots time[],
  timezone_name text DEFAULT 'UTC'
) RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  local_now timestamp;
  target_date date;
  next_slot time;
  next_run timestamptz;
  slot time;
BEGIN
  -- 指定されたタイムゾーンでの現在時刻を取得
  local_now := p_current_time AT TIME ZONE timezone_name;
  target_date := local_now::date;
  
  -- 今日の残りの時間スロットをチェック
  FOREACH slot IN ARRAY time_slots
  LOOP
    IF slot > local_now::time THEN
      next_slot := slot;
      EXIT;
    END IF;
  END LOOP;
  
  -- 今日の残りスロットがない場合は明日の最初のスロット
  IF next_slot IS NULL THEN
    next_slot := time_slots[1];
    target_date := target_date + INTERVAL '1 day';
  END IF;
  
  -- 次回実行時刻を構築
  next_run := (target_date + next_slot) AT TIME ZONE timezone_name;
  
  RETURN next_run;
END;
$$;