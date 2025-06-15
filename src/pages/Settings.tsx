import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Bell, Shield, Trash2, Save, Loader2, Upload } from "lucide-react";
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

  const [notifications, setNotifications] = useState({
    email_posts: true,
    email_replies: true,
    email_analytics: false,
    push_posts: true,
    push_replies: true
  });

  const [privacy, setPrivacy] = useState({
    public_profile: false,
    share_analytics: false,
    data_collection: true
  });

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

  const deleteAccount = async () => {
    if (confirm("本当にアカウントを削除しますか？この操作は取り消せません。")) {
      try {
        // In a real app, you would implement account deletion
        toast({
          title: "アカウント削除",
          description: "この機能は現在開発中です。",
          variant: "destructive",
        });
      } catch (error) {
        console.error('Error deleting account:', error);
        toast({
          title: "エラー",
          description: "アカウントの削除に失敗しました。",
          variant: "destructive",
        });
      }
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">プロフィール</TabsTrigger>
            <TabsTrigger value="notifications">通知</TabsTrigger>
            <TabsTrigger value="privacy">プライバシー</TabsTrigger>
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

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  通知設定
                </CardTitle>
                <CardDescription>
                  各種通知の受信設定を管理できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-3">メール通知</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">投稿生成完了</p>
                          <p className="text-xs text-muted-foreground">AI投稿生成が完了した時</p>
                        </div>
                        <Switch
                          checked={notifications.email_posts}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_posts: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">自動返信実行</p>
                          <p className="text-xs text-muted-foreground">自動返信が実行された時</p>
                        </div>
                        <Switch
                          checked={notifications.email_replies}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_replies: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">分析レポート</p>
                          <p className="text-xs text-muted-foreground">週次分析レポート</p>
                        </div>
                        <Switch
                          checked={notifications.email_analytics}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_analytics: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-3">プッシュ通知</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">投稿アクティビティ</p>
                          <p className="text-xs text-muted-foreground">投稿関連の通知</p>
                        </div>
                        <Switch
                          checked={notifications.push_posts}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, push_posts: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">返信アクティビティ</p>
                          <p className="text-xs text-muted-foreground">返信関連の通知</p>
                        </div>
                        <Switch
                          checked={notifications.push_replies}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, push_replies: checked }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Settings */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  プライバシー設定
                </CardTitle>
                <CardDescription>
                  データの使用と共有に関する設定
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">プロフィール公開</p>
                      <p className="text-xs text-muted-foreground">他のユーザーがプロフィールを閲覧可能</p>
                    </div>
                    <Switch
                      checked={privacy.public_profile}
                      onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, public_profile: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">分析データ共有</p>
                      <p className="text-xs text-muted-foreground">匿名化された分析データの共有</p>
                    </div>
                    <Switch
                      checked={privacy.share_analytics}
                      onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, share_analytics: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">利用データ収集</p>
                      <p className="text-xs text-muted-foreground">サービス改善のためのデータ収集</p>
                    </div>
                    <Switch
                      checked={privacy.data_collection}
                      onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, data_collection: checked }))}
                    />
                  </div>
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

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-2 text-destructive">危険な操作</h3>
                    <div className="space-y-4">
                      <div className="border border-destructive/20 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">アカウント削除</p>
                            <p className="text-xs text-muted-foreground">
                              すべてのデータが永久に削除されます。この操作は取り消せません。
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={deleteAccount}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            削除
                          </Button>
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