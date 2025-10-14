-- Phase 2 Step 2: Rate Limiting Database Function
-- レート制限用のupsert関数を作成

CREATE OR REPLACE FUNCTION upsert_rate_limit(
  p_endpoint text,
  p_identifier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_one_minute_ago timestamptz;
BEGIN
  v_one_minute_ago := now() - INTERVAL '1 minute';
  
  -- 既存のレコードを探す
  SELECT window_start INTO v_window_start
  FROM rate_limits
  WHERE endpoint = p_endpoint
    AND identifier = p_identifier
    AND window_start >= v_one_minute_ago
  FOR UPDATE;
  
  IF FOUND THEN
    -- 既存レコードを更新
    UPDATE rate_limits
    SET request_count = request_count + 1,
        created_at = now()
    WHERE endpoint = p_endpoint
      AND identifier = p_identifier
      AND window_start = v_window_start;
  ELSE
    -- 古いレコードを削除
    DELETE FROM rate_limits
    WHERE endpoint = p_endpoint
      AND identifier = p_identifier
      AND window_start < v_one_minute_ago;
    
    -- 新しいレコードを挿入
    INSERT INTO rate_limits (endpoint, identifier, request_count, window_start)
    VALUES (p_endpoint, p_identifier, 1, now());
  END IF;
END;
$$;

-- セキュリティイベントログ記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'phase_2_rate_limiting',
  jsonb_build_object(
    'step', 'completed',
    'features', ARRAY[
      'rate_limit_function_added',
      'threads_webhook_protected',
      'auto_reply_protected'
    ],
    'limits', jsonb_build_object(
      'threads_webhook', '60 req/min',
      'generate_auto_reply', '30 req/min per persona'
    ),
    'timestamp', now()
  )
);