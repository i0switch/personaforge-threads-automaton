
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SecureInput, SecureTextarea } from "@/components/SecureInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bot, MessageSquare, Settings, User, Clock, AlertTriangle } from "lucide-react";
import { AvatarUpload } from "./AvatarUpload";
import { ThreadsOAuthButton } from "./ThreadsOAuthButton";
import type { Persona, PersonaFormData } from "@/types/persona";

interface PersonaFormProps {
  editingPersona: Persona | null;
  onSubmit: (data: PersonaFormData) => Promise<void>;
  onCancel: () => void;
}

export const PersonaForm = ({ editingPersona, onSubmit, onCancel }: PersonaFormProps) => {
  const [formData, setFormData] = useState<PersonaFormData>({
    name: "",
    age: "",
    personality: "",
    expertise: "",
    tone_of_voice: "",
    avatar_url: "",
    threads_app_id: "",
    threads_app_secret: "",
    threads_access_token: "",
    threads_username: "",
    webhook_verify_token: "",
    auto_reply_enabled: false,
    ai_auto_reply_enabled: false,
    auto_reply_delay_minutes: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingPersona) {
      setFormData({
        name: editingPersona.name || "",
        age: editingPersona.age ?? "",
        personality: editingPersona.personality ?? "",
        expertise: Array.isArray(editingPersona.expertise) 
          ? editingPersona.expertise.join(", ") 
          : "",
        tone_of_voice: editingPersona.tone_of_voice ?? "",
        avatar_url: editingPersona.avatar_url ?? "",
        threads_app_id: editingPersona.threads_app_id ?? "",
        threads_app_secret: editingPersona.threads_app_secret ? "***設定済み***" : "",
        threads_access_token: editingPersona.threads_access_token ?? "",
        threads_username: editingPersona.threads_username ?? "",
        webhook_verify_token: editingPersona.webhook_verify_token ?? "",
        auto_reply_enabled: editingPersona.auto_reply_enabled || false,
        ai_auto_reply_enabled: editingPersona.ai_auto_reply_enabled || false,
        auto_reply_delay_minutes: editingPersona.auto_reply_delay_minutes || 0
      });
    } else {
      // 新規作成時は完全にリセット
      setFormData({
        name: "",
        age: "",
        personality: "",
        expertise: "",
        tone_of_voice: "",
        avatar_url: "",
        threads_app_id: "",
        threads_app_secret: "",
        threads_access_token: "",
        threads_username: "",
        webhook_verify_token: "",
        auto_reply_enabled: false,
        ai_auto_reply_enabled: false,
        auto_reply_delay_minutes: 0
      });
    }
  }, [editingPersona]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarChange = (url: string) => {
    setFormData(prev => ({
      ...prev,
      avatar_url: url
    }));
  };

  // 自動返信の排他制御
  const handleAutoReplyChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      auto_reply_enabled: checked,
      ai_auto_reply_enabled: checked ? false : prev.ai_auto_reply_enabled
    }));
  };

  const handleAiAutoReplyChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      ai_auto_reply_enabled: checked,
      auto_reply_enabled: checked ? false : prev.auto_reply_enabled
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {editingPersona ? "ペルソナを編集" : "新しいペルソナを作成"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本情報 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">名前 *</Label>
                <SecureInput
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="ペルソナの名前"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">年齢</Label>
                <SecureInput
                  id="age"
                  value={formData.age}
                  onChange={(e) => handleInputChange("age", e.target.value)}
                  placeholder="例: 25歳"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="personality">性格 *</Label>
              <SecureTextarea
                id="personality"
                value={formData.personality}
                onChange={(e) => handleInputChange("personality", e.target.value)}
                placeholder="ペルソナの性格や特徴を詳しく説明してください"
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expertise">専門分野</Label>
              <SecureInput
                id="expertise"
                value={formData.expertise}
                onChange={(e) => handleInputChange("expertise", e.target.value)}
                placeholder="例: テクノロジー, マーケティング, デザイン (カンマ区切り)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone_of_voice">話し方・トーン</Label>
              <SecureInput
                id="tone_of_voice"
                value={formData.tone_of_voice}
                onChange={(e) => handleInputChange("tone_of_voice", e.target.value)}
                placeholder="例: フレンドリー, 専門的, カジュアル"
              />
            </div>

            {/* アバターアップロード */}
            <AvatarUpload
              personaId={editingPersona?.id}
              currentAvatarUrl={formData.avatar_url}
              onAvatarChange={handleAvatarChange}
            />

            <Separator />

            {/* 自動返信設定 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5" />
                <h3 className="text-lg font-semibold">自動返信設定</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>トリガー自動返信を有効にする</Label>
                    <p className="text-sm text-muted-foreground">
                      リプライを受信した時に設定した定型文を自動で返信します
                    </p>
                  </div>
                  <Switch
                    checked={formData.auto_reply_enabled}
                    onCheckedChange={handleAutoReplyChange}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>AI自動返信を有効にする</Label>
                    <p className="text-sm text-muted-foreground">
                      AIが内容を分析して自動で返信を生成します
                    </p>
                  </div>
                  <Switch
                    checked={formData.ai_auto_reply_enabled}
                    onCheckedChange={handleAiAutoReplyChange}
                  />
                </div>

                {/* 自動返信遅延設定 */}
                {(formData.auto_reply_enabled || formData.ai_auto_reply_enabled) && (
                  <div className="space-y-2">
                    <Label htmlFor="auto_reply_delay" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      自動返信の遅延時間（分）
                    </Label>
                    <SecureInput
                      id="auto_reply_delay"
                      type="number"
                      min="0"
                      max="1440"
                      value={formData.auto_reply_delay_minutes.toString()}
                      onChange={(e) => handleInputChange("auto_reply_delay_minutes", parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <p className="text-sm text-muted-foreground">
                      リプライ受信から返信までの遅延時間を設定します（0-1440分）
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Threads API設定 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Threads API設定</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="threads_app_id">Threads App ID</Label>
                  <SecureInput
                    id="threads_app_id"
                    value={formData.threads_app_id}
                    onChange={(e) => handleInputChange("threads_app_id", e.target.value)}
                    placeholder="Threads App ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="threads_username">Threadsユーザー名</Label>
                  <SecureInput
                    id="threads_username"
                    value={formData.threads_username}
                    onChange={(e) => handleInputChange("threads_username", e.target.value)}
                    placeholder="@username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="threads_app_secret">Threads App Secret</Label>
                <SecureInput
                  id="threads_app_secret"
                  type="password"
                  value={formData.threads_app_secret}
                  onChange={(e) => handleInputChange("threads_app_secret", e.target.value)}
                  placeholder={editingPersona ? "変更する場合のみ入力" : "Threads App Secret"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="threads_access_token">Threads Access Token</Label>
                <SecureInput
                  id="threads_access_token"
                  type="password"
                  value={formData.threads_access_token}
                  onChange={(e) => handleInputChange("threads_access_token", e.target.value)}
                  placeholder="Threads Access Token"
                />
                <p className="text-xs text-muted-foreground">
                  手動入力、またはOAuth認証で自動取得できます。
                </p>
              </div>

              {/* threads_user_id未設定警告 */}
              {editingPersona && editingPersona.threads_access_token && !editingPersona.threads_user_id && (
                <Alert variant="destructive" className="border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">⚠️ Threads User IDが未設定です。</span>
                    自動返信・リプライ監視が正常に動作しません。OAuth認証を再実行するか、管理者に問い合わせてください。
                  </AlertDescription>
                </Alert>
              )}

              {/* コールバックURL案内 */}
              <Alert className="border-primary/30 bg-primary/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">FacebookDevアプリのコールバックURL設定：</span>
                  <br />
                  リダイレクト欄に下記のURLを必ず追加してください。
                  <br />
                  <code className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs font-mono select-all">
                    https://threads-genius-ai.lovable.app/auth/callback
                  </code>
                </AlertDescription>
              </Alert>

              {/* OAuth認証ボタン（常に表示） */}
              <ThreadsOAuthButton
                personaId={editingPersona?.id || ''}
                appId={formData.threads_app_id}
                disabled={false}
                missingFields={{
                  appId: !formData.threads_app_id,
                  appSecret: !formData.threads_app_secret || formData.threads_app_secret === '',
                  notSaved: !editingPersona?.id,
                }}
              />

              <div className="space-y-2">
                <Label htmlFor="webhook_verify_token">Webhook確認トークン</Label>
                <SecureInput
                  id="webhook_verify_token"
                  value={formData.webhook_verify_token}
                  onChange={(e) => handleInputChange("webhook_verify_token", e.target.value)}
                  placeholder="Webhook確認用のトークン"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "保存中..." : editingPersona ? "更新" : "作成"}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                キャンセル
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
