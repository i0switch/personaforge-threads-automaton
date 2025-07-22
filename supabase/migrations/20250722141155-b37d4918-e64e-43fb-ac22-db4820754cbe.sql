-- thread_repliesテーブルにリアルタイム機能を有効化
ALTER TABLE public.thread_replies REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_replies;