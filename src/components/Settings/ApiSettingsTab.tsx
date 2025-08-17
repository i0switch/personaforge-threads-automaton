
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Edit, Plus, Trash2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GeminiApiKey {
  id: string;
  keyName: string;
  displayName: string;
  isSet: boolean;
  value: string;
  isEditing: boolean;
}

export const ApiSettingsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [saving, setSaving] = useState(false);
  const [geminiApiKeys, setGeminiApiKeys] = useState<GeminiApiKey[]>([]);
  const [huggingfaceSpaceUrl, setHuggingfaceSpaceUrl] = useState("");
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

      // Initialize Gemini API keys array
      const geminiKeys: GeminiApiKey[] = [];
      
      // Check for existing Gemini API keys (up to 10)
      for (let i = 1; i <= 10; i++) {
        const keyName = i === 1 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${i}`;
        const existingKey = data?.find(k => k.key_name === keyName);
        
        geminiKeys.push({
          id: `gemini-${i}`,
          keyName,
          displayName: `Gemini API Key ${i}`,
          isSet: !!existingKey,
          value: existingKey ? '設定済み' : '',
          isEditing: false
        });
      }
      
      setGeminiApiKeys(geminiKeys);

      // Handle HuggingFace URL as before
      const hfUrl = data?.find(k => k.key_name === 'HUGGINGFACE_SPACE_URL');
      if (hfUrl) setHuggingfaceSpaceUrl('設定済み');
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
      if (keyName.startsWith('GEMINI_API_KEY')) {
        setGeminiApiKeys(prev => prev.map(key => 
          key.keyName === keyName 
            ? { ...key, isSet: true, value: '設定済み', isEditing: false }
            : key
        ));
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

  const toggleGeminiKeyEditing = (keyId: string) => {
    setGeminiApiKeys(prev => prev.map(key => 
      key.id === keyId 
        ? { ...key, isEditing: !key.isEditing }
        : key
    ));
  };

  const updateGeminiKeyValue = (keyId: string, value: string) => {
    setGeminiApiKeys(prev => prev.map(key => 
      key.id === keyId 
        ? { ...key, value }
        : key
    ));
  };

  const deleteGeminiKey = async (keyName: string) => {
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', user?.id)
        .eq('key_name', keyName);

      if (error) throw error;

      setGeminiApiKeys(prev => prev.map(key => 
        key.keyName === keyName 
          ? { ...key, isSet: false, value: '', isEditing: false }
          : key
      ));

      toast({
        title: "成功",
        description: "APIキーが削除されました",
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: "エラー",
        description: "APIキーの削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gemini API設定
          </CardTitle>
          <CardDescription>
            AI投稿生成と自動返信に使用するGemini APIキーを最大10個まで設定できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              複数のAPIキーを設定することで、使用制限回避とレート制限の分散が可能です。
            </AlertDescription>
          </Alert>
          
          {geminiApiKeys.map((apiKey) => (
            <div key={apiKey.id} className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="font-medium">{apiKey.displayName}</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleGeminiKeyEditing(apiKey.id)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    {apiKey.isEditing ? 'キャンセル' : apiKey.isSet ? '編集' : '追加'}
                  </Button>
                  {apiKey.isSet && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteGeminiKey(apiKey.keyName)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {apiKey.isEditing ? (
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Gemini API Keyを入力"
                    value={apiKey.value === '設定済み' ? '' : apiKey.value}
                    onChange={(e) => updateGeminiKeyValue(apiKey.id, e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => saveApiKey(apiKey.keyName, apiKey.value)}
                    disabled={saving || !apiKey.value.trim()}
                  >
                    保存
                  </Button>
                </div>
              ) : (
                <Input
                  type="password"
                  value={apiKey.isSet ? '設定済み' : '未設定'}
                  disabled
                  className="bg-muted"
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            その他のAPI設定
          </CardTitle>
          <CardDescription>
            画像生成など他のサービス連携設定
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
    </div>
  );
};
