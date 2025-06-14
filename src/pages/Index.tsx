import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Calendar, Bot, Image, Settings, BarChart3, Clock, Users, Zap, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [stats] = useState({
    todayPosts: 12,
    scheduledPosts: 24,
    autoReplies: 8,
    engagement: 85
  });

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
              <p className="text-xs text-muted-foreground">+20% 前日比</p>
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

        {/* Current Persona */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              現在のペルソナ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=150" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <h3 className="font-semibold">AIアシスタント みか</h3>
                <p className="text-sm text-muted-foreground">フレンドリーで親しみやすい20代女性。テクノロジーとライフスタイルに詳しい。</p>
                <div className="flex gap-2">
                  <Badge variant="secondary">テック系</Badge>
                  <Badge variant="secondary">ライフスタイル</Badge>
                  <Badge variant="secondary">フレンドリー</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>最近のアクティビティ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">新しい投稿を12件生成しました</p>
                  <p className="text-xs text-muted-foreground">5分前</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 p-2 rounded-full">
                  <Image className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">画像を8枚自動生成完了</p>
                  <p className="text-xs text-muted-foreground">15分前</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-orange-100 p-2 rounded-full">
                  <Zap className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">3件の返信を自動送信</p>
                  <p className="text-xs text-muted-foreground">30分前</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
