-- ランダムポスト設定に最後の投稿日を追加
ALTER TABLE public.random_post_configs 
ADD COLUMN last_posted_date DATE DEFAULT NULL;

-- 投稿済み時間を記録するためのカラム追加
ALTER TABLE public.random_post_configs 
ADD COLUMN posted_times_today JSONB DEFAULT '[]'::jsonb;