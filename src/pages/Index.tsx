import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Bot, Image, Settings, BarChart3, Clock, Users, Zap, LogOut, Plus, Edit, Trash2, Loader2, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type ActivityLog = Database['public']['Tables']['activity_logs']['Row'] & {
  personas?: Pick<Database['public']['Tables']['personas']['Row'], 'name' | 'avatar_url'>;
};

const Index = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  
  const [stats, setStats] = useState({
    todayPosts: 0,
    scheduledPosts: 0,
    autoReplies: 0,
    engagement: 0
  });

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [deletingPersona, setDeletingPersona] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("7");

  useEffect(() => {
    if (user) {
      loadPersonas();
      loadStats();
      loadActivityLogs();
    }
  }, [user, selectedPeriod]);

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

  const loadStats = async () => {
    if (!user) return;
    
    setLoadingStats(true);
    try {
      const days = parseInt(selectedPeriod);
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      // Get today's posts
      const { data: todayPosts, error: todayError } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', startOfDay(new Date()).toISOString())
        .lte('created_at', endOfDay(new Date()).toISOString());

      if (todayError) throw todayError;

      // Get scheduled posts
      const { data: scheduledPosts, error: scheduledError } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .gte('scheduled_for', new Date().toISOString());

      if (scheduledError) throw scheduledError;

      // Get auto replies count
      const { data: autoReplies, error: repliesError } = await supabase
        .from('auto_replies')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (repliesError) throw repliesError;

      // Get analytics data for engagement calculation
      const { data: analytics, error: analyticsError } = await supabase
        .from('analytics')
        .select('engagement_rate, posts_count')
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (analyticsError) throw analyticsError;

      // Calculate average engagement
      let avgEngagement = 0;
      if (analytics && analytics.length > 0) {
        const totalEngagement = analytics.reduce((sum, record) => sum + (record.engagement_rate || 0), 0);
        avgEngagement = totalEngagement / analytics.length;
      }

      setStats({
        todayPosts: todayPosts?.length || 0,
        scheduledPosts: scheduledPosts?.length || 0,
        autoReplies: autoReplies?.length || 0,
        engagement: Math.round(avgEngagement)
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: "エラー",
        description: "統計データの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const loadActivityLogs = async () => {
    if (!user) return;
    
    try {
      const days = parseInt(selectedPeriod);
      const startDate = subDays(new Date(), days);

      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          personas!inner(name, avatar_url)
        `)
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error loading activity logs:', error);
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
      title: "AI画像生成",
      description: "顔画像からAI画像生成",
      icon: Image,
      color: "bg-pink-500",
      path: "/image-generation"
    },
    {
      title: "新規ペルソナ作成",
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

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'post_created': '投稿作成',
      'posts_scheduled': '投稿予約',
      'post_published': '投稿公開',
      'auto_reply_sent': '自動返信',
      'auto_reply_created': '自動返信設定',
      'auto_reply_updated': '自動返信更新',
      'persona_created': 'ペルソナ作成',
      'persona_updated': 'ペルソナ更新'
    };
    return labels[actionType] || actionType;
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

        {/* Stats Period Selector */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">統計期間:</span>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">今日</SelectItem>
              <SelectItem value="7">過去7日</SelectItem>
              <SelectItem value="30">過去30日</SelectItem>
              <SelectItem value="90">過去90日</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {selectedPeriod === "1" ? "今日の投稿" : `過去${selectedPeriod}日の投稿`}
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.todayPosts}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.todayPosts === 0 ? "投稿を作成して開始" : "投稿作成済み"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">予約投稿</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.scheduledPosts}
              </div>
              <p className="text-xs text-muted-foreground">今後の予約投稿</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">自動返信ルール</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.autoReplies}
              </div>
              <p className="text-xs text-muted-foreground">有効なルール数</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">エンゲージメント</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : `${stats.engagement}%`}
              </div>
              <Progress value={stats.engagement} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                                onClick={()={() => deletePersona(persona.id)}}
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
            <CardDescription>
              過去{selectedPeriod}日間のアクティビティログ
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activityLogs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">まだアクティビティはありません</p>
                <p className="text-sm text-muted-foreground">投稿作成や自動返信を使用すると、ここにアクティビティが表示されます</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={log.personas?.avatar_url || ""} />
                      <AvatarFallback>
                        {log.personas?.name?.[0]?.toUpperCase() || "A"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {getActionTypeLabel(log.action_type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'MM/dd HH:mm', { locale: ja })}
                        </span>
                      </div>
                      <p className="text-sm">{log.description}</p>
                    </div>
                  </div>
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
