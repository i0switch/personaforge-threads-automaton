
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PersonaForm } from "@/components/PersonaSetup/PersonaForm";
import { PersonaList } from "@/components/PersonaSetup/PersonaList";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

const PersonaSetup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersonas();
  }, [user]);

  const loadPersonas = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error('Error loading personas:', error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaCreated = () => {
    setIsCreating(false);
    setEditingPersona(null);
    loadPersonas();
  };

  const handleEditPersona = (persona: Persona) => {
    setEditingPersona(persona);
    setIsCreating(true);
  };

  const handleDeletePersona = async (personaId: string) => {
    try {
      const { error } = await supabase
        .from('personas')
        .delete()
        .eq('id', personaId)
        .eq('user_id', user!.id);

      if (error) throw error;

      setPersonas(prev => prev.filter(p => p.id !== personaId));
      toast({
        title: "成功",
        description: "ペルソナを削除しました。",
      });
    } catch (error) {
      console.error('Error deleting persona:', error);
      toast({
        title: "エラー",
        description: "ペルソナの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (personaId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('personas')
        .update({ is_active: isActive })
        .eq('id', personaId)
        .eq('user_id', user!.id);

      if (error) throw error;

      setPersonas(prev => 
        prev.map(p => 
          p.id === personaId ? { ...p, is_active: isActive } : p
        )
      );

      toast({
        title: "成功",
        description: `ペルソナを${isActive ? 'アクティブ' : '非アクティブ'}にしました。`,
      });
    } catch (error) {
      console.error('Error toggling persona status:', error);
      toast({
        title: "エラー",
        description: "ペルソナの状態変更に失敗しました。",
        variant: "destructive",
      });
    }
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
            ダッシュボードに戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">ペルソナ設定</h1>
            <p className="text-muted-foreground">AIキャラクターを作成・管理</p>
          </div>
          {!isCreating && (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          )}
        </div>

        {isCreating ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingPersona ? 'ペルソナ編集' : '新規ペルソナ作成'}
              </CardTitle>
              <CardDescription>
                AIキャラクターの詳細情報を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PersonaForm
                persona={editingPersona}
                onSuccess={handlePersonaCreated}
                onCancel={() => {
                  setIsCreating(false);
                  setEditingPersona(null);
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <PersonaList
            personas={personas}
            onEdit={handleEditPersona}
            onDelete={handleDeletePersona}
            onToggleActive={handleToggleActive}
          />
        )}
      </div>
    </div>
  );
};

export default PersonaSetup;
