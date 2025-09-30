-- 古い10分間隔のcronジョブを削除

-- jobid:13 (10分間隔の古いジョブ)を削除
SELECT cron.unschedule(13);

-- その他の重複ジョブも確認して削除
SELECT cron.unschedule(12);  -- auto-scheduler-cron (5分間隔)

-- 現在の有効なcronジョブのみ残す:
-- jobid:20: auto-post-generator (1分間隔) ← これだけ残す
-- jobid:21: auto-scheduler (1分間隔) ← これだけ残す