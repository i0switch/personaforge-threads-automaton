
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { AvatarUpload } from "./AvatarUpload";

interface Persona {
  id: string;
  name: string;
  age: string;
  personality: string;
  expertise: string[];
  tone_of_voice: string;
  avatar_url?: string;
  is_active: boolean;
  threads_app_id?: string;
  threads_app_secret?: string;
  webhook_verify_token?: string;
  reply_mode?: string;
}

interface PersonaFormProps {
  editingPersona: Persona | null;
  onSubmit: (formData: any) => Promise<void>;
  onCancel: () => void;
}

export const PersonaForm = ({ editingPersona, onSubmit, onCancel }: PersonaFormProps) => {
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [formData, setFormData] = useState({
    name: editingPersona?.name || "",
    age: editingPersona?.age || "",
    personality: editingPersona?.personality || "",
    expertise: editingPersona?.expertise?.join(", ") || "",
    tone_of_voice: editingPersona?.tone_of_voice || "",
    avatar_url: editingPersona?.avatar_url || "",
    threads_app_id: editingPersona?.threads_app_id || "",
    threads_app_secret: editingPersona?.threads_app_secret || "",
    webhook_verify_token: editingPersona?.webhook_verify_token || "",
    reply_mode: editingPersona?.reply_mode || "disabled"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-xl">
          {editingPersona ? "ペルソナを編集" : "新しいペルソナを作成"}
        </CardTitle>
        <CardDescription>
          AIペルソナの基本情報とThreads APIの設定を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">基本情報</h3>
            
            {/* Avatar Upload */}
            <AvatarUpload
              personaId={editingPersona?.id}
              currentAvatarUrl={formData.avatar_url}
              onAvatarChange={(url) => setFormData({ ...formData, avatar_url: url })}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">名前 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="age">年齢</Label>
                <Input
                  id="age"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="personality">性格・特徴</Label>
              <Textarea
                id="personality"
                value={formData.personality}
                onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                rows={4}
                className="mt-1"
                placeholder="ペルソナの性格や特徴を詳しく記述してください..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expertise">専門分野（カンマ区切り）</Label>
                <Input
                  id="expertise"
                  value={formData.expertise}
                  onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                  placeholder="例: テクノロジー, マーケティング, デザイン"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="tone_of_voice">口調・トーン</Label>
                <Input
                  id="tone_of_voice"
                  value={formData.tone_of_voice}
                  onChange={(e) => setFormData({ ...formData, tone_of_voice: e.target.value })}
                  placeholder="例: フレンドリー, 専門的, カジュアル"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Auto Reply Mode Selection */}
            <div>
              <Label htmlFor="reply_mode">自動返信モード</Label>
              <Select value={formData.reply_mode} onValueChange={(value) => setFormData({ ...formData, reply_mode: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="自動返信モードを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">無効</SelectItem>
                  <SelectItem value="keyword">キーワード自動返信</SelectItem>
                  <SelectItem value="ai">AI自動返信</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                キーワード: 特定のキーワードに反応して定型文を返信 / AI: 文脈を理解してAIが返信を生成
              </p>
            </div>
          </div>

          {/* API Settings Section */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Threads API設定</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="threads_app_id">Threads App ID</Label>
                <Input
                  id="threads_app_id"
                  value={formData.threads_app_id}
                  onChange={(e) => setFormData({ ...formData, threads_app_id: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="threads_app_secret">Threads App Secret</Label>
                <div className="relative mt-1">
                  <Input
                    id="threads_app_secret"
                    type={showAppSecret ? "text" : "password"}
                    value={formData.threads_app_secret}
                    onChange={(e) => setFormData({ ...formData, threads_app_secret: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowAppSecret(!showAppSecret)}
                  >
                    {showAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="webhook_verify_token">Webhook Verify Token</Label>
                <div className="relative mt-1">
                  <Input
                    id="webhook_verify_token"
                    type={showVerifyToken ? "text" : "password"}
                    value={formData.webhook_verify_token}
                    onChange={(e) => setFormData({ ...formData, webhook_verify_token: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowVerifyToken(!showVerifyToken)}
                  >
                    {showVerifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" size="lg">
              {editingPersona ? "更新" : "作成"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onCancel}
            >
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
