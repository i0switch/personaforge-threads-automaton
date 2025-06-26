
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, EyeOff } from "lucide-react";

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
}

const PersonaSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
    threads_app_id: "",
    threads_app_secret: "",
    webhook_verify_token: ""
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
        threads_app_id: formData.threads_app_id || null,
        webhook_verify_token: formData.webhook_verify_token || null,
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
        // 編集時で新しい値が入力されていない場合は既存の値を保持
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
        threads_app_id: "",
        threads_app_secret: "",
        webhook_verify_token: ""
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
          // 復号化に失敗した場合はプレースホルダーを表示
          decryptedSecret = "***設定済み***";
        }
      } catch (error) {
        console.error("Error retrieving secret:", error);
        // エラーの場合もプレースホルダーを表示
        decryptedSecret = "***設定済み***";
      }
    }
    
    setFormData({
      name: persona.name,
      age: persona.age || "",
      personality: persona.personality || "",
      expertise: persona.expertise?.join(", ") || "",
      tone_of_voice: persona.tone_of_voice || "",
      threads_app_id: persona.threads_app_id || "",
      threads_app_secret: decryptedSecret,
      webhook_verify_token: persona.webhook_verify_token || ""
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

  if (loading) {
    return <div className="flex justify-center p-8">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ペルソナ設定</h1>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            新しいペルソナを作成
          </Button>
        )}
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingPersona ? "ペルソナを編集" : "新しいペルソナを作成"}
            </CardTitle>
            <CardDescription>
              AIペルソナの基本情報とThreads APIの設定を入力してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">名前 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="age">年齢</Label>
                  <Input
                    id="age"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="personality">性格・特徴</Label>
                <Textarea
                  id="personality"
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="expertise">専門分野（カンマ区切り）</Label>
                <Input
                  id="expertise"
                  value={formData.expertise}
                  onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                  placeholder="例: テクノロジー, マーケティング, デザイン"
                />
              </div>

              <div>
                <Label htmlFor="tone_of_voice">口調・トーン</Label>
                <Input
                  id="tone_of_voice"
                  value={formData.tone_of_voice}
                  onChange={(e) => setFormData({ ...formData, tone_of_voice: e.target.value })}
                  placeholder="例: フレンドリー, 専門的, カジュアル"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Threads API設定</h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="threads_app_id">Threads App ID</Label>
                    <Input
                      id="threads_app_id"
                      value={formData.threads_app_id}
                      onChange={(e) => setFormData({ ...formData, threads_app_id: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="threads_app_secret">Threads App Secret</Label>
                    <div className="relative">
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
                    <div className="relative">
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

              <div className="flex space-x-2">
                <Button type="submit">
                  {editingPersona ? "更新" : "作成"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingPersona(null);
                    setFormData({
                      name: "",
                      age: "",
                      personality: "",
                      expertise: "",
                      tone_of_voice: "",
                      threads_app_id: "",
                      threads_app_secret: "",
                      webhook_verify_token: ""
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

      <div className="grid gap-4">
        {personas.map((persona) => (
          <Card key={persona.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {persona.name}
                    <Badge variant={persona.is_active ? "default" : "secondary"}>
                      {persona.is_active ? "有効" : "無効"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {persona.age && `年齢: ${persona.age}`}
                    {persona.tone_of_voice && ` | トーン: ${persona.tone_of_voice}`}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(persona.id, persona.is_active)}
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
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {persona.personality && (
                  <p><strong>性格:</strong> {persona.personality}</p>
                )}
                {persona.expertise && persona.expertise.length > 0 && (
                  <div>
                    <strong>専門分野:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {persona.expertise.map((skill, index) => (
                        <Badge key={index} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {persona.threads_app_id && (
                  <p><strong>Threads App ID:</strong> {persona.threads_app_id}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PersonaSetup;
