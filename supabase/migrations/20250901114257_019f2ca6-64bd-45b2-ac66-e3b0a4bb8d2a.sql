-- ryuji56460121@yahoo.co.jpの下書きになった自動生成投稿を修復
-- 1. ユーザーIDと現在のauto_post_configを確認
DO $$
DECLARE
    target_user_id UUID;
    target_persona_id UUID := 'd25e01d0-ca09-4fe4-905f-5d6ff4bd0925';
    current_config RECORD;
    post_record RECORD;
    next_schedule_time TIMESTAMPTZ;
    time_counter INTEGER := 0;
BEGIN
    -- ユーザーIDを取得
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'ryuji56460121@yahoo.co.jp';
    
    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User not found';
        RETURN;
    END IF;
    
    -- 現在のauto_post_configを取得
    SELECT * INTO current_config 
    FROM auto_post_configs 
    WHERE persona_id = target_persona_id AND is_active = true;
    
    IF current_config IS NULL THEN
        RAISE NOTICE 'No active auto_post_config found';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found config: next_run_at=%, post_times=%', current_config.next_run_at, current_config.post_times;
    
    -- 下書きになった自動生成投稿を取得（作成日時順）
    FOR post_record IN 
        SELECT id, created_at 
        FROM posts 
        WHERE user_id = target_user_id 
          AND persona_id = target_persona_id
          AND status = 'draft' 
          AND auto_schedule = true
          AND published_at IS NULL
        ORDER BY created_at ASC
    LOOP
        -- スケジュール時間を計算（複数時間設定対応）
        IF current_config.multi_time_enabled AND current_config.post_times IS NOT NULL THEN
            -- 複数時間の場合：post_timesの配列から順次割り当て
            next_schedule_time := current_config.next_run_at + 
                (time_counter * INTERVAL '1 day') + 
                (EXTRACT(EPOCH FROM (current_config.post_times[1 + (time_counter % array_length(current_config.post_times, 1))] - current_config.post_times[1])) * INTERVAL '1 second');
        ELSE
            -- 単一時間の場合：1日ずつ後ろにずらす
            next_schedule_time := current_config.next_run_at + (time_counter * INTERVAL '1 day');
        END IF;
        
        RAISE NOTICE 'Restoring post %: scheduled_for=%', post_record.id, next_schedule_time;
        
        -- 投稿をscheduled状態に復元
        UPDATE posts 
        SET status = 'scheduled',
            scheduled_for = next_schedule_time,
            updated_at = NOW()
        WHERE id = post_record.id;
        
        -- post_queueに追加（重複チェック）
        INSERT INTO post_queue (user_id, post_id, scheduled_for, queue_position, status)
        SELECT target_user_id, post_record.id, next_schedule_time, 0, 'queued'
        WHERE NOT EXISTS (
            SELECT 1 FROM post_queue WHERE post_id = post_record.id
        );
        
        time_counter := time_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Restored % posts for persona %', time_counter, target_persona_id;
    
    -- アクティビティログに記録
    INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
    VALUES (
        target_user_id,
        target_persona_id,
        'posts_restored',
        'Restored auto-generated draft posts to scheduled status',
        jsonb_build_object(
            'restored_count', time_counter,
            'persona_name', 'ちさ',
            'timestamp', NOW()
        )
    );
END $$;