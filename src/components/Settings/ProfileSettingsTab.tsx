
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Loader2, Upload, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileSettingsTabProps {
  profile: Profile | null;
  onProfileUpdate: () => void;
}

export const ProfileSettingsTab = ({ profile, onProfileUpdate }: ProfileSettingsTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(profile?.auto_reply_enabled || false);

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
      
      onProfileUpdate();
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

  return (
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
  );
};
