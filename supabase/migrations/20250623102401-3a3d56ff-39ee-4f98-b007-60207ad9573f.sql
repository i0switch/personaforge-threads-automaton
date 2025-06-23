
-- リプライ情報を保存するテーブルを作成
CREATE TABLE public.thread_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  persona_id UUID REFERENCES public.personas(id),
  original_post_id TEXT NOT NULL,
  reply_id TEXT NOT NULL UNIQUE,
  reply_text TEXT NOT NULL,
  reply_author_id TEXT NOT NULL,
  reply_author_username TEXT,
  reply_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_reply_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLSポリシーを設定
ALTER TABLE public.thread_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own replies" 
  ON public.thread_replies 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own replies" 
  ON public.thread_replies 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies" 
  ON public.thread_replies 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Webhook設定を保存するテーブル
CREATE TABLE public.webhook_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  persona_id UUID REFERENCES public.personas(id),
  webhook_url TEXT,
  verify_token TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own webhook settings" 
  ON public.webhook_settings 
  FOR ALL 
  USING (auth.uid() = user_id);

-- リプライチェック設定テーブル
CREATE TABLE public.reply_check_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  persona_id UUID REFERENCES public.personas(id),
  check_interval_minutes INTEGER DEFAULT 5,
  last_check_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reply_check_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reply check settings" 
  ON public.reply_check_settings 
  FOR ALL 
  USING (auth.uid() = user_id);

-- 更新時刻自動更新のトリガーを追加
CREATE TRIGGER update_thread_replies_updated_at
  BEFORE UPDATE ON public.thread_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhook_settings_updated_at
  BEFORE UPDATE ON public.webhook_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reply_check_settings_updated_at
  BEFORE UPDATE ON public.reply_check_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
