
-- posts テーブルに自動化関連のカラムを追加
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_schedule BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_time_slots TEXT[];

-- スケジューリング設定テーブルを作成
CREATE TABLE IF NOT EXISTS public.scheduling_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  persona_id UUID,
  optimal_hours INTEGER[] DEFAULT ARRAY[9,12,15,18,21], -- 最適な投稿時間（時）
  timezone TEXT DEFAULT 'Asia/Tokyo',
  auto_schedule_enabled BOOLEAN DEFAULT false,
  queue_limit INTEGER DEFAULT 10,
  retry_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS ポリシーを設定
ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduling settings" 
  ON public.scheduling_settings 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduling settings" 
  ON public.scheduling_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduling settings" 
  ON public.scheduling_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduling settings" 
  ON public.scheduling_settings 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 投稿キューテーブルを作成
CREATE TABLE IF NOT EXISTS public.post_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  queue_position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE
);

-- RLS ポリシーを設定
ALTER TABLE public.post_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queue items" 
  ON public.post_queue 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own queue items" 
  ON public.post_queue 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue items" 
  ON public.post_queue 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queue items" 
  ON public.post_queue 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 更新時刻を自動更新するトリガーを追加
CREATE TRIGGER update_scheduling_settings_updated_at
  BEFORE UPDATE ON public.scheduling_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_post_queue_updated_at
  BEFORE UPDATE ON public.post_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
