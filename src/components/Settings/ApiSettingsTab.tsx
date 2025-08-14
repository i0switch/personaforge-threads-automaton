
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Edit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const ApiSettingsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [saving, setSaving] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [huggingfaceSpaceUrl, setHuggingfaceSpaceUrl] = useState("");
  const [editingGemini, setEditingGemini] = useState(false);
  const [editingHuggingface, setEditingHuggingface] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, [user]);

  const loadApiKeys = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('key_name, encrypted_key')
        .eq('user_id', user.id);

      if (error) throw error;

      if (data) {
        const geminiKey = data.find(k => k.key_name === 'GEMINI_API_KEY');
        const hfUrl = data.find(k => k.key_name === 'HUGGINGFACE_SPACE_URL');
        
        if (geminiKey) setGeminiApiKey('設定済み');
        if (hfUrl) setHuggingfaceSpaceUrl('設定済み');
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const saveApiKey = async (keyName: string, keyValue: string) => {
    if (!user || !keyValue.trim()) return;
    
    setSaving(true);
    try {
      // セッション更新を試行
      let currentSession = null;
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // セッションリフレッシュを試行
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData?.session) {
          throw new Error('セッションの有効期限が切れています。再ログインしてください。');
        }
        currentSession = refreshData.session;
      } else {
        currentSession = session;
      }

      if (!currentSession) {
        throw new Error('認証が必要です');
      }

      const response = await supabase.functions.invoke('save-secret', {
        body: {
          keyName: keyName,
          keyValue: keyValue
        },
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'APIキーの保存に失敗しました');
      }

      toast({
        title: "成功",
        description: "APIキーを保存しました。",
      });

      // Reset editing states
      if (keyName === 'GEMINI_API_KEY') {
        setEditingGemini(false);
        setGeminiApiKey('設定済み');
      } else if (keyName === 'HUGGINGFACE_SPACE_URL') {
        setEditingHuggingface(false);
        setHuggingfaceSpaceUrl('設定済み');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: "エラー",
        description: error.message || "APIキーの保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API設定
        </CardTitle>
        <CardDescription>
          外部サービスとの連携に必要なAPIキーを管理
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Gemini API Key</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingGemini(!editingGemini)}
            >
              <Edit className="h-4 w-4 mr-1" />
              {editingGemini ? 'キャンセル' : '編集'}
            </Button>
          </div>
          {editingGemini ? (
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Gemini API Keyを入力"
                value={geminiApiKey === '設定済み' ? '' : geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={() => saveApiKey('GEMINI_API_KEY', geminiApiKey)}
                disabled={saving}
              >
                保存
              </Button>
            </div>
          ) : (
            <Input
              type="password"
              value={geminiApiKey}
              disabled
              className="bg-muted"
            />
          )}
          <p className="text-xs text-muted-foreground">
            AI投稿生成と自動返信に使用されます
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>HuggingFace Space URL</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingHuggingface(!editingHuggingface)}
            >
              <Edit className="h-4 w-4 mr-1" />
              {editingHuggingface ? 'キャンセル' : '編集'}
            </Button>
          </div>
          {editingHuggingface ? (
            <div className="flex gap-2">
              <Input
                placeholder="HuggingFace Space URLを入力"
                value={huggingfaceSpaceUrl === '設定済み' ? '' : huggingfaceSpaceUrl}
                onChange={(e) => setHuggingfaceSpaceUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={() => saveApiKey('HUGGINGFACE_SPACE_URL', huggingfaceSpaceUrl)}
                disabled={saving}
              >
                保存
              </Button>
            </div>
          ) : (
            <Input
              value={huggingfaceSpaceUrl}
              disabled
              className="bg-muted"
            />
          )}
          <p className="text-xs text-muted-foreground">
            AI画像生成に使用されます（例: i0switch/my-image-generator）
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
