
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Key, Shield, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ApiKey {
  id: string;
  key_name: string;
  created_at: string;
  updated_at: string;
}

export const SecureApiSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      fetchApiKeys();
    }
  }, [user]);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('id, key_name, created_at, updated_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('APIキーの取得エラー:', error);
      toast({
        title: "エラー",
        description: "APIキーの取得に失敗しました",
        variant: "destructive",
      });
    }
  };

  const saveApiKey = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      toast({
        title: "エラー",
        description: "キー名とキー値を入力してください",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('認証が必要です');

      const response = await supabase.functions.invoke('save-secret', {
        body: {
          keyName: newKeyName,
          keyValue: newKeyValue
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'APIキーの保存に失敗しました');
      }

      toast({
        title: "成功",
        description: "APIキーが安全に保存されました",
      });

      setNewKeyName("");
      setNewKeyValue("");
      await fetchApiKeys();
    } catch (error) {
      console.error('APIキー保存エラー:', error);
      toast({
        title: "エラー",
        description: error.message || "APIキーの保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const retrieveApiKey = async (keyName: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('認証が必要です');

      const response = await supabase.functions.invoke('retrieve-secret', {
        body: { keyName },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'APIキーの取得に失敗しました');
      }

      setKeyValues(prev => ({
        ...prev,
        [keyName]: response.data.keyValue
      }));

      setShowValues(prev => ({
        ...prev,
        [keyName]: true
      }));
    } catch (error) {
      console.error('APIキー取得エラー:', error);
      toast({
        title: "エラー",
        description: error.message || "APIキーの取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteApiKey = async (keyName: string) => {
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', user?.id)
        .eq('key_name', keyName);

      if (error) throw error;

      toast({
        title: "成功",
        description: "APIキーが削除されました",
      });

      // 状態をクリア
      setKeyValues(prev => {
        const newValues = { ...prev };
        delete newValues[keyName];
        return newValues;
      });
      
      setShowValues(prev => {
        const newShow = { ...prev };
        delete newShow[keyName];
        return newShow;
      });

      await fetchApiKeys();
    } catch (error) {
      console.error('APIキー削除エラー:', error);
      toast({
        title: "エラー",
        description: "APIキーの削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  const toggleShowValue = (keyName: string) => {
    if (showValues[keyName]) {
      setShowValues(prev => ({
        ...prev,
        [keyName]: false
      }));
    } else {
      retrieveApiKey(keyName);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          APIキーはAES-256-GCM暗号化により安全に保存されます。暗号化キーはSupabase Secretsで管理されています。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            新しいAPIキーを追加
          </CardTitle>
          <CardDescription>
            外部APIキーを安全に暗号化して保存します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keyName">キー名</Label>
            <Input
              id="keyName"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="例: GEMINI_API_KEY"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyValue">キー値</Label>
            <Input
              id="keyValue"
              type="password"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="APIキーを入力してください"
            />
          </div>
          <Button 
            onClick={saveApiKey} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            暗号化して保存
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>保存済みAPIキー</CardTitle>
          <CardDescription>
            暗号化されて保存されているAPIキーの一覧
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              保存されているAPIキーはありません
            </p>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{apiKey.key_name}</div>
                    <div className="text-sm text-muted-foreground">
                      作成日: {new Date(apiKey.created_at).toLocaleDateString('ja-JP')}
                    </div>
                    {showValues[apiKey.key_name] && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm font-mono break-all">
                        {keyValues[apiKey.key_name]}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleShowValue(apiKey.key_name)}
                      disabled={loading}
                    >
                      {showValues[apiKey.key_name] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteApiKey(apiKey.key_name)}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
