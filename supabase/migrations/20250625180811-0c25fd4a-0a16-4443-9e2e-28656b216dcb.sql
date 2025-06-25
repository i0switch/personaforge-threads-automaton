
-- 全テーブルの既存ポリシーを確実に削除
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- analytics テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'analytics' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.analytics';
    END LOOP;
    
    -- activity_logs テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'activity_logs' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.activity_logs';
    END LOOP;
    
    -- auto_replies テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'auto_replies' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.auto_replies';
    END LOOP;
    
    -- personas テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'personas' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.personas';
    END LOOP;
    
    -- posts テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'posts' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.posts';
    END LOOP;
    
    -- profiles テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.profiles';
    END LOOP;
    
    -- post_queue テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'post_queue' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.post_queue';
    END LOOP;
    
    -- reply_check_settings テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'reply_check_settings' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.reply_check_settings';
    END LOOP;
    
    -- scheduling_settings テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'scheduling_settings' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.scheduling_settings';
    END LOOP;
    
    -- thread_replies テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'thread_replies' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.thread_replies';
    END LOOP;
    
    -- user_api_keys テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'user_api_keys' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.user_api_keys';
    END LOOP;
    
    -- webhook_settings テーブルのポリシー削除
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = 'webhook_settings' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.webhook_settings';
    END LOOP;
END $$;

-- 新しいRLSポリシーを作成

-- analytics テーブル
CREATE POLICY "Users can view their own analytics" 
ON public.analytics FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics" 
ON public.analytics FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics" 
ON public.analytics FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all analytics" 
ON public.analytics FOR SELECT 
USING (public.is_admin(auth.uid()));

-- activity_logs テーブル
CREATE POLICY "Users can view their own activity logs" 
ON public.activity_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs" 
ON public.activity_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity logs" 
ON public.activity_logs FOR SELECT 
USING (public.is_admin(auth.uid()));

-- auto_replies テーブル
CREATE POLICY "Users can view their own auto replies" 
ON public.auto_replies FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auto replies" 
ON public.auto_replies FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto replies" 
ON public.auto_replies FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto replies" 
ON public.auto_replies FOR DELETE 
USING (auth.uid() = user_id);

-- personas テーブル
CREATE POLICY "Users can view their own personas" 
ON public.personas FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own personas" 
ON public.personas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personas" 
ON public.personas FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personas" 
ON public.personas FOR DELETE 
USING (auth.uid() = user_id);

-- posts テーブル
CREATE POLICY "Users can view their own posts" 
ON public.posts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own posts" 
ON public.posts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
ON public.posts FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
ON public.posts FOR DELETE 
USING (auth.uid() = user_id);

-- profiles テーブル
CREATE POLICY "Users can view their own profiles" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.is_admin(auth.uid()));

-- post_queue テーブル
CREATE POLICY "Users can view their own post queue" 
ON public.post_queue FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own post queue" 
ON public.post_queue FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own post queue" 
ON public.post_queue FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own post queue" 
ON public.post_queue FOR DELETE 
USING (auth.uid() = user_id);

-- reply_check_settings テーブル
CREATE POLICY "Users can view their own reply settings" 
ON public.reply_check_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reply settings" 
ON public.reply_check_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reply settings" 
ON public.reply_check_settings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reply settings" 
ON public.reply_check_settings FOR DELETE 
USING (auth.uid() = user_id);

-- scheduling_settings テーブル
CREATE POLICY "Users can view their own scheduling settings" 
ON public.scheduling_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduling settings" 
ON public.scheduling_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduling settings" 
ON public.scheduling_settings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduling settings" 
ON public.scheduling_settings FOR DELETE 
USING (auth.uid() = user_id);

-- thread_replies テーブル
CREATE POLICY "Users can view their own thread replies" 
ON public.thread_replies FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own thread replies" 
ON public.thread_replies FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own thread replies" 
ON public.thread_replies FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own thread replies" 
ON public.thread_replies FOR DELETE 
USING (auth.uid() = user_id);

-- user_api_keys テーブル
CREATE POLICY "Users can view their own API keys" 
ON public.user_api_keys FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" 
ON public.user_api_keys FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" 
ON public.user_api_keys FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" 
ON public.user_api_keys FOR DELETE 
USING (auth.uid() = user_id);

-- webhook_settings テーブル
CREATE POLICY "Users can view their own webhook settings" 
ON public.webhook_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhook settings" 
ON public.webhook_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook settings" 
ON public.webhook_settings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook settings" 
ON public.webhook_settings FOR DELETE 
USING (auth.uid() = user_id);
