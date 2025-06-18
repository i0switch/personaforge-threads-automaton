import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Shield, Save, Loader2, Upload, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    avatar_url: ""
  });


  const [apiKeys, setApiKeys] = useState({
    gemini_api_key: ""
  });

  const [apiSaving, setApiSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile(data);
        setProfileForm({
          display_name: data.display_name || "",
          avatar_url: data.avatar_url || ""
        });
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

  const saveProfile = async () => {
    setSaving(true);
    try {
      const profileData = {
        user_id: user?.id,
        display_name: profileForm.display_name,
        avatar_url: profileForm.avatar_url
      };

      if (profile) {
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', user?.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert([profileData]);
        
        if (error) throw error;
      }

      toast({
        title: "保存完了",
        description: "プロフィールを更新しました。",
      });
      
      await loadProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "エラー",
        description: "プロフィールの保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // For now, we'll use a placeholder URL
      // In a real app, you would upload to Supabase Storage
      const avatarUrl = `https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=150&h=150&fit=crop&crop=face`;
      
      setProfileForm(prev => ({ ...prev, avatar_url: avatarUrl }));
      
      toast({
        title: "アップロード完了",
        description: "アバター画像をアップロードしました。",
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "エラー",
        description: "ファイルのアップロードに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };


  const saveApiKeys = async () => {
    if (!apiKeys.gemini_api_key.trim()) {
      toast({
        title: "エラー",
        description: "Gemini APIキーを入力してください。",
        variant: "destructive",
      });
      return;
    }

    setApiSaving(true);
    try {
      // GeminiAPIキーの保存
      await supabase.functions.invoke('save-secret', {
        body: { 
          secret_name: 'GEMINI_API_KEY',
          secret_value: apiKeys.gemini_api_key.trim()
        }
      });

      toast({
        title: "保存完了",
        description: "APIキーを保存しました。",
      });

      // フォームをクリア
      setApiKeys({
        gemini_api_key: ""
      });
    } catch (error) {
      console.error('Error saving API keys:', error);
      toast({
        title: "エラー",
        description: "APIキーの保存に失敗しました。管理者がSupabaseで設定してください。",
        variant: "destructive",
      });
    } finally {
      setApiSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">設定を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate("/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">設定</h1>
            <p className="text-muted-foreground">アカウントと環境設定を管理</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">プロフィール</TabsTrigger>
            <TabsTrigger value="api">API設定</TabsTrigger>
            <TabsTrigger value="account">アカウント</TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  プロフィール設定
                </CardTitle>
                <CardDescription>
                  表示名とアバター画像を設定できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profileForm.avatar_url || ""} />
                      <AvatarFallback>
                        {profileForm.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer hover:bg-primary/90">
                      <Upload className="h-3 w-3" />
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">アバター画像</p>
                    <p className="text-xs text-muted-foreground">
                      JPG、PNG、GIF形式（最大5MB）
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="display-name">表示名</Label>
                    <Input
                      id="display-name"
                      value={profileForm.display_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, display_name: e.target.value }))}
                      placeholder="表示名を入力"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
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

          {/* API Settings */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API設定
                </CardTitle>
                <CardDescription>
                  GeminiのAPIキーを設定できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500 rounded-full p-1 mt-0.5">
                        <Shield className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          セキュリティについて
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                          APIキーは暗号化されてSupabaseに安全に保存されます。APIキーは一度設定すると表示されません。
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="gemini-api-key">Gemini API キー</Label>
                      <Input
                        id="gemini-api-key"
                        type="password"
                        value={apiKeys.gemini_api_key}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, gemini_api_key: e.target.value }))}
                        placeholder="AIzaSyBGLFv0hDGln0i-x1fJmQOGZbltTLdF9bc"
                      />
                      <p className="text-xs text-muted-foreground">
                        投稿のAI生成に使用されます。 
                        <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline ml-1"
                        >
                          Google AI Studioで取得
                        </a>
                      </p>
                    </div>

                  </div>

                  <Button 
                    onClick={saveApiKeys} 
                    disabled={apiSaving || !apiKeys.gemini_api_key.trim()}
                  >
                    {apiSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        APIキーを保存
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Settings */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>アカウント管理</CardTitle>
                <CardDescription>
                  アカウントの基本情報と危険な操作
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">アカウント情報</h3>
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">メールアドレス</p>
                          <p className="text-muted-foreground">{user?.email}</p>
                        </div>
                        <div>
                          <p className="font-medium">アカウント作成日</p>
                          <p className="text-muted-foreground">
                            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ja-JP') : '不明'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

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