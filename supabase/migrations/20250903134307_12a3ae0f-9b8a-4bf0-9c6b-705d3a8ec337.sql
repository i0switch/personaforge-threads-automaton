-- 全ペルソナの自動生成下書き投稿を一括修復
DO $$
DECLARE
    persona_record RECORD;
    post_record RECORD;
    config_record RECORD;
    next_schedule_time TIMESTAMPTZ;
    time_counter INTEGER;
    total_restored INTEGER := 0;
BEGIN
    -- 影響を受けた全ペルソナを処理
    FOR persona_record IN 
        SELECT DISTINCT 
            apc.user_id,
            apc.persona_id,
            p.name as persona_name,
            au.email as user_email,
            (SELECT COUNT(*) FROM posts WHERE persona_id = apc.persona_id AND status = 'draft' AND auto_schedule = true) as draft_count
        FROM auto_post_configs apc
        JOIN personas p ON apc.persona_id = p.id
        JOIN auth.users au ON apc.user_id = au.id
        WHERE apc.is_active = true
        AND (SELECT COUNT(*) FROM posts WHERE persona_id = apc.persona_id AND status = 'draft' AND auto_schedule = true) > 5
        ORDER BY draft_count DESC
    LOOP
        -- 現在のauto_post_configを取得
        SELECT * INTO config_record 
        FROM auto_post_configs 
        WHERE persona_id = persona_record.persona_id AND is_active = true
        LIMIT 1;
        
        IF config_record IS NULL THEN
            CONTINUE;
        END IF;
        
        RAISE NOTICE 'Processing persona: % (%) - User: %, Drafts: %', 
            persona_record.persona_name, persona_record.persona_id, 
            persona_record.user_email, persona_record.draft_count;
        
        time_counter := 0;
        
        -- 下書きになった自動生成投稿を取得（作成日時順）
        FOR post_record IN 
            SELECT id, created_at 
            FROM posts 
            WHERE user_id = persona_record.user_id 
              AND persona_id = persona_record.persona_id
              AND status = 'draft' 
              AND auto_schedule = true
              AND published_at IS NULL
            ORDER BY created_at ASC
        LOOP
            -- スケジュール時間を計算
            IF config_record.multi_time_enabled AND config_record.post_times IS NOT NULL THEN
                -- 複数時間の場合：post_timesの配列から順次割り当て
                next_schedule_time := config_record.next_run_at + 
                    (time_counter * INTERVAL '1 day') + 
                    (EXTRACT(EPOCH FROM (config_record.post_times[1 + (time_counter % array_length(config_record.post_times, 1))] - config_record.post_times[1])) * INTERVAL '1 second');
            ELSE
                -- 単一時間の場合：1日ずつ後ろにずらす
                next_schedule_time := config_record.next_run_at + (time_counter * INTERVAL '1 day');
            END IF;
            
            -- 投稿をscheduled状態に復元
            UPDATE posts 
            SET status = 'scheduled',
                scheduled_for = next_schedule_time,
                updated_at = NOW()
            WHERE id = post_record.id;
            
            -- post_queueに追加（重複チェック）
            INSERT INTO post_queue (user_id, post_id, scheduled_for, queue_position, status)
            SELECT persona_record.user_id, post_record.id, next_schedule_time, 0, 'queued'
            WHERE NOT EXISTS (
                SELECT 1 FROM post_queue WHERE post_id = post_record.id
            );
            
            time_counter := time_counter + 1;
            total_restored := total_restored + 1;
        END LOOP;
        
        RAISE NOTICE 'Restored % posts for persona %', time_counter, persona_record.persona_name;
        
        -- アクティビティログに記録
        INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
        VALUES (
            persona_record.user_id,
            persona_record.persona_id,
            'bulk_posts_restored',
            'Bulk restored auto-generated draft posts to scheduled status',
            jsonb_build_object(
                'restored_count', time_counter,
                'persona_name', persona_record.persona_name,
                'user_email', persona_record.user_email,
                'timestamp', NOW()
            )
        );
    END LOOP;
    
    RAISE NOTICE '=== BULK RESTORATION COMPLETE ===';
    RAISE NOTICE 'Total posts restored across all personas: %', total_restored;
END $$;