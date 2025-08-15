-- ランダムポスト機能用テーブルの作成
CREATE TABLE public.random_post_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  persona_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  random_times TIME[] NOT NULL DEFAULT '{}',
  next_run_at TIMESTAMP WITH TIME ZONE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS有効化
ALTER TABLE public.random_post_configs ENABLE ROW LEVEL SECURITY;

-- RLSポリシー作成
CREATE POLICY "Users can view their own random post configs" 
ON public.random_post_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own random post configs" 
ON public.random_post_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own random post configs" 
ON public.random_post_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own random post configs" 
ON public.random_post_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- updated_atトリガー追加
CREATE TRIGGER update_random_post_configs_updated_at
BEFORE UPDATE ON public.random_post_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();