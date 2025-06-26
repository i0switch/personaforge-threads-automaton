import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AvatarUpload } from "@/components/PersonaSetup/AvatarUpload";

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

const PersonaSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    personality: "",
    expertise: "",
    tone_of_voice: "",
    avatar_url: "",
    threads_app_id: "",
    threads_app_secret: "",
    webhook_verify_token: "",
    reply_mode: "disabled"
  });

  useEffect(() => {
    if (user) {
      loadPersonas();
    }
  }, [user]);

  const loadPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error("Error loading personas:", error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      const expertiseArray = formData.expertise.split(',').map(item => item.trim()).filter(Boolean);
      
      let personaData: any = {
        name: formData.name,
        age: formData.age,
        personality: formData.personality,
        expertise: expertiseArray,
        tone_of_voice: formData.tone_of_voice,
        avatar_url: formData.avatar_url || null,
        threads_app_id: formData.threads_app_id || null,
        webhook_verify_token: formData.webhook_verify_token || null,
        reply_mode: formData.reply_mode,
        user_id: user.id
      };

      // threads_app_secretが入力されている場合のみ暗号化して保存
      if (formData.threads_app_secret && formData.threads_app_secret.trim() !== "") {
        console.log("Encrypting threads_app_secret for persona:", editingPersona?.id || 'new');
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('認証が必要です');

        const response = await supabase.functions.invoke('save-secret', {
          body: {
            keyName: `threads_app_secret_${editingPersona?.id || 'new'}`,
            keyValue: formData.threads_app_secret
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          console.error("Encryption error:", response.error);
          throw new Error(response.error.message || 'APIキーの暗号化に失敗しました');
        }

        console.log("Encryption successful:", response.data);
        personaData.threads_app_secret = response.data.encrypted_key;
      } else if (editingPersona && editingPersona.threads_app_secret) {
        personaData.threads_app_secret = editingPersona.threads_app_secret;
      }

      if (editingPersona) {
        const { error } = await supabase
          .from("personas")
          .update(personaData)
          .eq("id", editingPersona.id);

        if (error) throw error;
        
        toast({
          title: "成功",
          description: "ペルソナが更新されました。",
        });
      } else {
        const { error } = await supabase
          .from("personas")
          .insert([personaData]);

        if (error) throw error;
        
        toast({
          title: "成功",
          description: "ペルソナが作成されました。",
        });
      }

      setFormData({
        name: "",
        age: "",
        personality: "",
        expertise: "",
        tone_of_voice: "",
        avatar_url: "",
        threads_app_id: "",
        threads_app_secret: "",
        webhook_verify_token: "",
        reply_mode: "disabled"
      });
      setIsEditing(false);
      setEditingPersona(null);
      loadPersonas();
    } catch (error) {
      console.error("Error saving persona:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "ペルソナの保存に失敗しました。",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      loadPersonas();
    }
  }, [user]);

  const loadPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error("Error loading personas:", error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (persona: Persona) => {
    console.log("Editing persona:", persona.id, "Has secret:", !!persona.threads_app_secret);
    setEditingPersona(persona);
    
    // 暗号化されたthreads_app_secretを復号化
    let decryptedSecret = "";
    if (persona.threads_app_secret) {
      try {
        console.log("Attempting to decrypt secret for persona:", persona.id);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('認証が必要です');

        const response = await supabase.functions.invoke('retrieve-secret', {
          body: {
            keyName: `threads_app_secret_${persona.id}`
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.error && response.data?.keyValue) {
          decryptedSecret = response.data.keyValue;
          console.log("Successfully decrypted secret");
        } else {
          console.error("Failed to decrypt secret:", response.error);
          decryptedSecret = "***設定済み***";
        }
      } catch (error) {
        console.error("Error retrieving secret:", error);
        decryptedSecret = "***設定済み***";
      }
    }
    
    setFormData({
      name: persona.name,
      age: persona.age || "",
      personality: persona.personality || "",
      expertise: persona.expertise?.join(", ") || "",
      tone_of_voice: persona.tone_of_voice || "",
      avatar_url: persona.avatar_url || "",
      threads_app_id: persona.threads_app_id || "",
      threads_app_secret: decryptedSecret,
      webhook_verify_token: persona.webhook_verify_token || "",
      reply_mode: persona.reply_mode || "disabled"
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このペルソナを削除してもよろしいですか？")) return;

    try {
      const { error } = await supabase
        .from("personas")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "ペルソナが削除されました。",
      });
      loadPersonas();
    } catch (error) {
      console.error("Error deleting persona:", error);
      toast({
        title: "エラー",
        description: "ペルソナの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("personas")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "成功",
        description: `ペルソナが${!currentStatus ? "有効" : "無効"}になりました。`,
      });
      loadPersonas();
    } catch (error) {
      console.error("Error toggling persona status:", error);
      toast({
        title: "エラー",
        description: "ペルソナの状態変更に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const getReplyModeLabel = (mode: string) => {
    switch (mode) {
      case 'ai':
        return { label: 'AI自動返信', variant: 'default' as const };
      case 'keyword':
        return { label: 'キーワード返信', variant: 'secondary' as const };
      default:
        return { label: '無効', variant: 'outline' as const };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="flex justify-center p-8">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            ダッシュボードに戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">ペルソナ設定</h1>
            <p className="text-muted-foreground mt-1">
              AIペルソナの管理とThreads API設定
            </p>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} size="lg">
              新しいペルソナを作成
            </Button>
          )}
        </div>

        {/* Edit Form Section */}
        {isEditing && (
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
                    onClick={() => {
                      setIsEditing(false);
                      setEditingPersona(null);
                      setFormData({
                        name: "",
                        age: "",
                        personality: "",
                        expertise: "",
                        tone_of_voice: "",
                        avatar_url: "",
                        threads_app_id: "",
                        threads_app_secret: "",
                        webhook_verify_token: "",
                        reply_mode: "disabled"
                      });
                    }}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Personas List Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">登録済みペルソナ</h2>
          {personas.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-4">まだペルソナが登録されていません</p>
                <Button onClick={() => setIsEditing(true)}>
                  最初のペルソナを作成
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {personas.map((persona) => {
                const replyModeInfo = getReplyModeLabel(persona.reply_mode || 'disabled');
                return (
                  <Card key={persona.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {persona.avatar_url && (
                            <img
                              src={persona.avatar_url}
                              alt={persona.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg truncate">{persona.name}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              {persona.age && `年齢: ${persona.age}`}
                              <div className="flex gap-1 ml-auto">
                                <Badge variant={persona.is_active ? "default" : "secondary"}>
                                  {persona.is_active ? "有効" : "無効"}
                                </Badge>
                                <Badge variant={replyModeInfo.variant}>
                                  {replyModeInfo.label}
                                </Badge>
                              </div>
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {persona.personality && (
                        <div>
                          <p className="text-sm font-medium mb-1">性格:</p>
                          <p className="text-sm text-muted-foreground line-clamp-3">{persona.personality}</p>
                        </div>
                      )}
                      
                      {persona.tone_of_voice && (
                        <div>
                          <p className="text-sm font-medium mb-1">トーン:</p>
                          <p className="text-sm text-muted-foreground">{persona.tone_of_voice}</p>
                        </div>
                      )}

                      {persona.expertise && persona.expertise.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">専門分野:</p>
                          <div className="flex flex-wrap gap-1">
                            {persona.expertise.slice(0, 3).map((skill, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {persona.expertise.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{persona.expertise.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {persona.threads_app_id && (
                        <div>
                          <p className="text-sm font-medium mb-1">Threads App ID:</p>
                          <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                            {persona.threads_app_id}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(persona.id, persona.is_active)}
                          className="flex-1"
                        >
                          {persona.is_active ? "無効化" : "有効化"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(persona)}
                        >
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(persona.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonaSetup;
