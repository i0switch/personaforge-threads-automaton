
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PersonaForm } from "@/components/PersonaSetup/PersonaForm";
import { PersonaList } from "@/components/PersonaSetup/PersonaList";

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
  threads_access_token?: string;
  threads_username?: string;
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

  const handleSubmit = async (formData: any) => {
    if (!user) return;

    try {
      const expertiseArray = formData.expertise.split(',').map((item: string) => item.trim()).filter(Boolean);
      
      let personaData: any = {
        name: formData.name,
        age: formData.age,
        personality: formData.personality,
        expertise: expertiseArray,
        tone_of_voice: formData.tone_of_voice,
        avatar_url: formData.avatar_url || null,
        threads_app_id: formData.threads_app_id || null,
        threads_access_token: formData.threads_access_token || null,
        threads_username: formData.threads_username || null,
        webhook_verify_token: formData.webhook_verify_token || null,
        auto_reply_enabled: formData.auto_reply_enabled || false,
        ai_auto_reply_enabled: formData.ai_auto_reply_enabled || false,
        user_id: user.id
      };

      // threads_app_secretが入力されている場合のみ暗号化して保存
      if (formData.threads_app_secret && formData.threads_app_secret.trim() !== "" && formData.threads_app_secret !== "***設定済み***") {
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

      handleCancel();
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

  const handleCancel = () => {
    setIsEditing(false);
    setEditingPersona(null);
  };

  const handleCreateNew = () => {
    setEditingPersona(null);
    setIsEditing(true);
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
            <Button onClick={handleCreateNew} size="lg">
              新しいペルソナを作成
            </Button>
          )}
        </div>

        {/* Edit Form Section */}
        {isEditing && (
          <PersonaForm
            editingPersona={editingPersona}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}

        {/* Personas List Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">登録済みペルソナ</h2>
          <PersonaList
            personas={personas}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={toggleActive}
            onCreateNew={handleCreateNew}
          />
        </div>
      </div>
    </div>
  );
};

export default PersonaSetup;
