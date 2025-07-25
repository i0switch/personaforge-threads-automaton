-- personas_secureテーブルのRLS有効化とポリシー作成
ALTER TABLE public.personas_secure ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のpersonas_secureのみ表示可能
CREATE POLICY "Users can view their own secure personas" 
ON public.personas_secure 
FOR SELECT 
USING (auth.uid() = user_id);

-- ユーザーは自分のpersonas_secureのみ作成可能
CREATE POLICY "Users can create their own secure personas" 
ON public.personas_secure 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のpersonas_secureのみ更新可能
CREATE POLICY "Users can update their own secure personas" 
ON public.personas_secure 
FOR UPDATE 
USING (auth.uid() = user_id);

-- ユーザーは自分のpersonas_secureのみ削除可能
CREATE POLICY "Users can delete their own secure personas" 
ON public.personas_secure 
FOR DELETE 
USING (auth.uid() = user_id);

-- 管理者は全てのpersonas_secureを管理可能
CREATE POLICY "Admins can manage all secure personas" 
ON public.personas_secure 
FOR ALL 
USING (is_admin(auth.uid()));