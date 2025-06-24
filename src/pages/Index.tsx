import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Calendar, 
  MessageSquare, 
  Settings, 
  Edit, 
  Trash2, 
  User,
  MessageCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPersonas();
    }
  }, [user]);

  const loadPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user!.id)
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

  const deletePersona = async (id: string) => {
    try {
      const { error } = await supabase
        .from('personas')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) throw error;

      setPersonas(personas.filter(p => p.id !== id));
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

  const quickActions = [
    {
      title: "投稿作成",
      description: "新しい投稿を作成",
      icon: Plus,
      action: () => navigate("/create-posts"),
      color: "bg-blue-500"
    },
    {
      title: "投稿管理",
      description: "予定済み投稿を確認",
      icon: Calendar,
      action: () => navigate("/scheduled-posts"),
      color: "bg-green-500"
    },
    {
      title: "自動返信",
      description: "自動返信を設定",
      icon: MessageSquare,
      action: () => navigate("/auto-reply"),
      color: "bg-orange-500"
    },
    {
      title: "リプライ監視",
      description: "リプライを監視・管理",
      icon: MessageCircle,
      action: () => navigate("/reply-monitoring"),
      color: "bg-red-500"
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              AI Social Manager
            </h1>
            <p className="text-xl text-muted-foreground mt-2">
              AIペルソナでソーシャルメディアを自動化
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/settings")} variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              設定
            </Button>
            <Button onClick={signOut} variant="outline">
              ログアウト
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Card key={index} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={action.action}>
              <CardContent className="p-4 text-center">
                <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{action.title}</h3>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Personas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                AIペルソナ管理
              </CardTitle>
              <CardDescription>
                AIペルソナを作成・管理してコンテンツを自動生成
              </CardDescription>
            </div>
            <Button onClick={() => navigate("/persona-setup")}>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">読み込み中...</p>
              </div>
            ) : personas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  まだペルソナが作成されていません
                </p>
                <Button onClick={() => navigate("/persona-setup")}>
                  <Plus className="h-4 w-4 mr-2" />
                  最初のペルソナを作成
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {personas.map((persona) => (
                  <Card key={persona.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={persona.avatar_url || undefined} />
                          <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-semibold">{persona.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {persona.age}
                          </p>
                        </div>
                        <Badge variant={persona.is_active ? "default" : "secondary"}>
                          {persona.is_active ? "アクティブ" : "非アクティブ"}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {persona.personality}
                      </p>
                      
                      {persona.expertise && persona.expertise.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
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
                      )}
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => navigate(`/persona-setup?id=${persona.id}`)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          編集
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => deletePersona(persona.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
