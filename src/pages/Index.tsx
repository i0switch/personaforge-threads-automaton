import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Calendar, Bot, Image, Settings, BarChart3, Clock, Users, Zap, LogOut, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

const Index = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [stats] = useState({
    todayPosts: 0,
    scheduledPosts: 0,
    autoReplies: 0,
    engagement: 0
  });

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [deletingPersona, setDeletingPersona] = useState<string | null>(null);

  useEffect(() => {
    loadPersonas();
  }, [user]);

  const loadPersonas = async () => {
    if (!user) return;
    
    setLoadingPersonas(true);
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
      setLoadingPersonas(false);
    }
  };

  const deletePersona = async (personaId: string) => {
    setDeletingPersona(personaId);
    try {
      const { error } = await supabase
        .from('personas')
        .delete()
        .eq('id', personaId)
        .eq('user_id', user?.id);

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
    } finally {
      setDeletingPersona(null);
    }
  };

  const quickActions = [
    {
      title: "新規投稿作成",
      description: "AIで投稿を一括生成",
      icon: Bot,
      color: "bg-blue-500",
      path: "/create-posts"
    },
    {
      title: "ペルソナ設定",
      description: "キャラクター設定を管理",
      icon: Users,
      color: "bg-purple-500", 
      path: "/persona-setup"
    },
    {
      title: "予約投稿管理",
      description: "スケジュール確認・編集",
      icon: Calendar,
      color: "bg-green-500",
      path: "/scheduled-posts"
    },
    {
      title: "自動返信設定",
      description: "返信ルールを設定",
      icon: Zap,
      color: "bg-orange-500",
      path: "/auto-reply"
    }
  ];

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "ログアウト",
      description: "正常にログアウトしました。",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AIThreads ダッシュボード</h1>
            <p className="text-muted-foreground">
              こんにちは、{user?.email}さん！自動運用ツールで効率的なSNS管理
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/settings")} variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              設定
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              ログアウト
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日の投稿</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayPosts}</div>
              <p className="text-xs text-muted-foreground">投稿を作成して開始</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">予約投稿</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.scheduledPosts}</div>
              <p className="text-xs text-muted-foreground">今後7日間</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">自動返信</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.autoReplies}</div>
              <p className="text-xs text-muted-foreground">今日の対応数</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">エンゲージメント</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.engagement}%</div>
              <Progress value={stats.engagement} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(action.path)}>
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-2`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Personas Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ペルソナ管理
              </CardTitle>
              <CardDescription>
                作成済みのペルソナを確認・編集できます
              </CardDescription>
            </div>
            <Button onClick={() => navigate("/persona-setup")} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </CardHeader>
          <CardContent>
            {loadingPersonas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>読み込み中...</span>
              </div>
            ) : personas.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">まだペルソナが作成されていません</p>
                <Button onClick={() => navigate("/persona-setup")} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  最初のペルソナを作成する
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {personas.map((persona) => (
                  <Card key={persona.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={persona.avatar_url || "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=150"} />
                          <AvatarFallback>{persona.name[0]?.toUpperCase() || "P"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{persona.name}</h3>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/persona-setup?id=${persona.id}`)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deletePersona(persona.id)}
                                disabled={deletingPersona === persona.id}
                              >
                                {deletingPersona === persona.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          {persona.age && (
                            <p className="text-sm text-muted-foreground">{persona.age}</p>
                          )}
                          {persona.personality && (
                            <p className="text-sm line-clamp-2">{persona.personality}</p>
                          )}
                          {persona.expertise && persona.expertise.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {persona.expertise.slice(0, 3).map((skill, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                              {persona.expertise.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{persona.expertise.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>最近のアクティビティ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">まだアクティビティはありません</p>
              <p className="text-sm text-muted-foreground">投稿作成や自動返信を使用すると、ここにアクティビティが表示されます</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
