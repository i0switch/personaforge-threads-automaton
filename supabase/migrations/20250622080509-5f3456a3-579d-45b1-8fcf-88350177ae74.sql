
-- 統計データを保存するテーブル
CREATE TABLE public.analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  persona_id UUID REFERENCES public.personas(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  posts_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, persona_id, date)
);

-- アクティビティログテーブル
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  persona_id UUID REFERENCES public.personas(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'post_created', 'auto_reply_sent', 'post_published', etc.
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies for analytics
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics" 
  ON public.analytics 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics" 
  ON public.analytics 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics" 
  ON public.analytics 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS policies for activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity logs" 
  ON public.activity_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs" 
  ON public.activity_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 更新トリガー
CREATE TRIGGER update_analytics_updated_at 
  BEFORE UPDATE ON public.analytics 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
