
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, 
  Calendar, 
  MessageCircle, 
  BarChart3, 
  Settings, 
  Plus,
  Eye,
  Timer,
  UserCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [stats, setStats] = useState({
    totalPosts: 0,
    scheduledPosts: 0,
    publishedPosts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      // Load personas
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id);

      if (personasError) throw personasError;
      setPersonas(personasData || []);

      // Load posts stats
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('status')
        .eq('user_id', user.id);

      if (postsError) throw postsError;

      const totalPosts = postsData?.length || 0;
      const scheduledPosts = postsData?.filter(p => p.status === 'scheduled').length || 0;
      const publishedPosts = postsData?.filter(p => p.status === 'published').length || 0;

      setStats({
        totalPosts,
        scheduledPosts,
        publishedPosts
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "エラー",
        description: "ダッシュボードデータの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "エラー",
        description: "ログアウトに失敗しました。",
        variant: "destructive",
      });
    }
  };

  const menuItems = [
    {
      title: "ペルソナ設定",
      description: "AIキャラクターの作成・管理",
      icon: User,
      action: () => navigate("/persona-setup"),
      buttonText: personas.length > 0 ? "設定・編集" : "開始する",
      stats: `${personas.length}個のペルソナ`
    },
    {
      title: "新規投稿作成",
      description: "AIが自動で投稿を生成",
      icon: Plus,
      action: () => navigate("/create-posts"),
      buttonText: "開始する",
      stats: "ワンクリックで投稿生成"
    },
    {
      title: "予約投稿管理",
      description: "スケジュール確認・編集・公開",
      icon: Calendar,
      action: () => navigate("/scheduled-posts"),
      buttonText: "開始する",
      stats: `${stats.scheduledPosts}件の予約投稿`
    },
    {
      title: "リプライ監視",
      description: "自動返信とコメント管理",
      icon: MessageCircle,
      action: () => navigate("/reply-monitoring"),
      buttonText: "開始する",
      stats: "リアルタイム監視"
    },
    {
      title: "スケジューリング",
      description: "自動投稿スケジュール管理",
      icon: Timer,
      action: () => navigate("/scheduling-dashboard"),
      buttonText: "開始する",
      stats: "自動スケジュール"
    },
    {
      title: "画像生成",
      description: "AI画像生成とカスタマイズ",
      icon: Eye,
      action: () => navigate("/image-generation"),
      buttonText: "開始する",
      stats: "高品質AI画像"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">AI Threads</h1>
            <p className="text-muted-foreground mt-2">
              AIを活用したソーシャルメディア管理プラットフォーム
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate("/settings")}
            >
              <Settings className="h-4 w-4 mr-2" />
              設定
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              ログアウト
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総投稿数</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPosts}</div>
              <p className="text-xs text-muted-foreground">全ての投稿</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">予約投稿</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.scheduledPosts}</div>
              <p className="text-xs text-muted-foreground">スケジュール済み</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">公開投稿</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.publishedPosts}</div>
              <p className="text-xs text-muted-foreground">公開済み</p>
            </CardContent>
          </Card>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {item.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {item.stats}
                  </span>
                  <Button 
                    onClick={item.action}
                    className="h-8"
                  >
                    {item.buttonText}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Personas */}
        {personas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>アクティブなペルソナ</CardTitle>
              <CardDescription>現在設定されているAIキャラクター</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {personas.slice(0, 6).map((persona) => (
                  <div key={persona.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={persona.avatar_url || ""} />
                      <AvatarFallback>{persona.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{persona.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {persona.is_active ? "アクティブ" : "非アクティブ"}
                      </p>
                    </div>
                  </div>
                ))}
                {personas.length > 6 && (
                  <div className="flex items-center justify-center p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      +{personas.length - 6} more
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
