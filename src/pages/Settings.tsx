
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Key, Bell, Save, Loader2, Upload, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile form states
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);

  // API Keys states
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [huggingfaceSpaceUrl, setHuggingfaceSpaceUrl] = useState("");
  const [editingGemini, setEditingGemini] = useState(false);
  const [editingHuggingface, setEditingHuggingface] = useState(false);

  useEffect(() => {
    loadProfile();
    loadApiKeys();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || "");
        setAvatarUrl(data.avatar_url || "");
        setAutoReplyEnabled(data.auto_reply_enabled);
      } else {
        // Create profile if it doesn't exist
        const newProfile = {
          user_id: user.id,
          display_name: user.email?.split('@')[0] || "",
          auto_reply_enabled: false
        };
        
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        if (createError) throw createError;
        
        setProfile(createdProfile);
        setDisplayName(createdProfile.display_name || "");
        setAvatarUrl(createdProfile.avatar_url || "");
        setAutoReplyEnabled(createdProfile.auto_reply_enabled);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "エラー",
        description: "プロフィールの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  const saveProfile = async () => {
    if (!user || !profile) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
          auto_reply_enabled: autoReplyEnabled
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "プロフィールを更新しました。",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "エラー",
        description: "プロフィールの更新に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveApiKey = async (keyName: string, keyValue: string) => {
    if (!user || !keyValue.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-secret', {
        body: {
          secret_name: keyName,
          secret_value: keyValue
        }
      });

      if (error) throw error;

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
        description: "APIキーの保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "ログアウト",
      description: "正常にログアウトしました。",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>読み込み中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">設定</h1>
            <p className="text-muted-foreground">
              アカウント設定とAPIキーの管理
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">プロフィール</TabsTrigger>
            <TabsTrigger value="api">API設定</TabsTrigger>
            <TabsTrigger value="account">アカウント</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  プロフィール設定
                </CardTitle>
                <CardDescription>
                  表示名やアバター画像を設定できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-lg">
                      {displayName[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Label>アバター画像URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="flex-1"
                      />
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>表示名</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="表示名を入力"
                  />
                </div>

                <div className="space-y-2">
                  <Label>メールアドレス</Label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    メールアドレスは変更できません
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-reply"
                    checked={autoReplyEnabled}
                    onCheckedChange={setAutoReplyEnabled}
                  />
                  <Label htmlFor="auto-reply">自動返信機能を有効にする</Label>
                </div>

                <Button onClick={saveProfile} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      プロフィールを保存
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <div className="grid gap-6">
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
            </div>
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>アカウント管理</CardTitle>
                <CardDescription>
                  アカウントの基本操作
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>アカウント情報</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">メールアドレス:</span> {user?.email}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">登録日:</span> {new Date(user?.created_at || '').toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleSignOut}
                    variant="destructive"
                  >
                    ログアウト
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
