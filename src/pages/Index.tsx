
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  MessageSquare, 
  Calendar, 
  Settings, 
  Bot, 
  BarChart3,
  Shield,
  Edit,
  ExternalLink,
  CheckCircle,
  Crown,
  Heart,
  Zap,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { AccountStatusBanner } from "@/components/AccountStatusBanner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isApproved, isActive } = useAccountStatus();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      setIsAdmin(data || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const features = [
    {
      title: "ペルソナ設定",
      description: "AIアシスタントの性格や専門分野を設定・編集",
      icon: Users,
      path: "/persona-setup",
      color: "text-blue-600",
      disabled: !isApproved || !isActive
    },
    {
      title: "投稿作成",
      description: "AIを使って魅力的な投稿を生成",
      icon: MessageSquare,
      path: "/create-posts",
      color: "text-green-600",
      disabled: !isApproved || !isActive
    },
    {
      title: "スケジュール管理",
      description: "投稿の予約と自動投稿設定",
      icon: Calendar,
      path: "/scheduled-posts",
      color: "text-purple-600",
      disabled: !isApproved || !isActive
    },
    {
      title: "自動返信",
      description: "コメントへの自動返信機能",
      icon: Bot,
      path: "/auto-reply",
      color: "text-orange-600",
      disabled: !isApproved || !isActive
    },
    {
      title: "返信監視",
      description: "返信の監視とレポート機能",
      icon: BarChart3,
      path: "/reply-monitoring",
      color: "text-red-600",
      disabled: !isApproved || !isActive
    },
    {
      title: "設定",
      description: "アカウント設定とAPIキー管理",
      icon: Settings,
      path: "/settings",
      color: "text-gray-600",
      disabled: false
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Threads-Genius AI
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Gemini搭載Threads自動運用ツール
          </p>
        </div>

        <AccountStatusBanner />

        {isAdmin && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <Shield className="h-5 w-5" />
                管理者機能
              </CardTitle>
              <CardDescription className="text-yellow-700">
                ユーザーアカウントの管理とシステム設定
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate("/admin")}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                <Shield className="h-4 w-4 mr-2" />
                管理者ダッシュボード
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={feature.title} 
                className={`hover:shadow-lg transition-shadow ${
                  feature.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/50'
                }`}
                onClick={() => !feature.disabled && navigate(feature.path)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                    {feature.title}
                    {feature.disabled && (
                      <Badge variant="secondary" className="text-xs">
                        無効
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled={feature.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!feature.disabled) navigate(feature.path);
                    }}
                  >
                    {feature.disabled ? 'アクセス不可' : (
                      feature.title === "ペルソナ設定" ? (
                        <span className="flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          設定・編集
                        </span>
                      ) : '開始する'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 特別広告セクション */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              💰 収益化加速ツール 💰
            </h2>
            <p className="text-muted-foreground">
              AIを使った最新の収益化手法をご紹介
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {/* 恋愛ジャンル広告 */}
            <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-rose-50 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-pink-800">
                  <Heart className="h-5 w-5" />
                  恋愛ジャンル攻略法
                </CardTitle>
                <CardDescription className="text-pink-700 font-medium">
                  「恋愛ジャンルはもう飽和」と思ってません？
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white/60 rounded-lg p-4 border border-pink-100">
                  <p className="text-gray-800 font-semibold mb-2">
                    まだまだ稼ぎ放題なんです。
                  </p>
                  <p className="text-gray-700 text-sm mb-3">
                    しかも、AIが勝手にネタ・コピーを全部作成。<br/>
                    あなたは投稿ボタンを押すだけ。
                  </p>
                  <div className="flex items-center gap-2 text-pink-600">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-medium">完全自動化システム</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white"
                  asChild
                >
                  <a 
                    href="https://note.com/mido_renai/n/n9a3cdcc9dc4f" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    恋愛ジャンル攻略法を見る
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* ドスケベライティング広告 */}
            <Card className="border-red-200 bg-gradient-to-br from-red-50 to-orange-50 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <Zap className="h-5 w-5" />
                  AIライティング革命
                </CardTitle>
                <CardDescription className="text-red-700 font-medium">
                  「エロが書けないAI」はもう時代遅れ。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white/60 rounded-lg p-4 border border-red-100">
                  <p className="text-gray-800 font-semibold mb-2">
                    AIで"売れるドスケベ文章"を量産可能に
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>売れるドスケベライティングをAIで爆速生成</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>心理学×FOMOを駆使して購買意欲を最大化</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>今ならまだ誰も知らない、先行者利益を独占！</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  asChild
                >
                  <a 
                    href="https://deeps.me/u/mountain_cb/a/ChatGPTHack" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    AIライティング手法を確認する
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* バズポストGPTs広告（大きく表示） */}
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800 text-xl">
                <TrendingUp className="h-6 w-6" />
                バズった裏垢女子ポストを大量学習済み
              </CardTitle>
              <CardDescription className="text-purple-700 font-medium text-lg">
                やばいGPTsができました - アダアフィ垢バズポスト自動生成GPTs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-white/60 rounded-lg p-4 border border-purple-100">
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-2xl">👱</div>
                  <div className="flex-1">
                    <p className="text-gray-800 mb-2">
                      <strong>アダアフィってめっちゃ稼げるよね</strong>
                    </p>
                    <p className="text-gray-700 text-sm">
                      そうなんだよね、でもさ...
                    </p>
                  </div>
                  <div className="text-2xl">🧔</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-bold text-lg text-gray-800">
                    こんなお悩みありませんか？
                  </h3>
                  
                  <div className="space-y-2">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700 text-sm">
                        ■ アダアフィやってみたいけど上手にポストが作れずインプが😭
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700 text-sm">
                        ■ 毎日継続してポスト作成できず結局利益が出ずに諦めてしまった
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700 text-sm">
                        ■ そもそもターゲットに刺さるポストが作れない😡
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700 text-sm">
                        ■ 生成AIでポスト作成を試みるもうまく生成できない、プロンプトも難しくて結局挫折🙇‍♂️
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-4 border border-orange-200">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-xl">💎</span>
                    そんなあなたへ
                  </h4>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span className="text-sm text-gray-700">
                        <strong>複雑なプロンプトは一切不要！</strong><br/>
                        超簡単な指示でバズるポストを大量生成
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span className="text-sm text-gray-700">
                        半年以上かけてリサーチした大量のバズポストをGPTsに学習済み
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span className="text-sm text-gray-700">
                        完全脳死で作業しても勝手にクオリティの高いポストを自動生成
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-purple-700 font-medium text-center mb-4">
                    バズるポストが簡単に作れる秘密の方法👇
                  </p>
                </div>
              </div>
              
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-6"
                asChild
              >
                <a 
                  href="https://deeps.me/u/mountain_cb/a/bazzpostGPTs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <Crown className="h-5 w-5" />
                  やばいGPTsの詳細を確認する
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
