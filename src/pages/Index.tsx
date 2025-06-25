
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
  Sparkles,
  Star,
  Rocket,
  Brain
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
      color: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 to-cyan-50",
      borderColor: "border-blue-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "投稿作成",
      description: "AIを使って魅力的な投稿を生成",
      icon: MessageSquare,
      path: "/create-posts",
      color: "from-green-500 to-emerald-500",
      bgGradient: "from-green-50 to-emerald-50",
      borderColor: "border-green-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "スケジュール管理",
      description: "投稿の予約と自動投稿設定",
      icon: Calendar,
      path: "/scheduled-posts",
      color: "from-purple-500 to-violet-500",
      bgGradient: "from-purple-50 to-violet-50",
      borderColor: "border-purple-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "自動返信",
      description: "コメントへの自動返信機能",
      icon: Bot,
      path: "/auto-reply",
      color: "from-orange-500 to-amber-500",
      bgGradient: "from-orange-50 to-amber-50",
      borderColor: "border-orange-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "返信監視",
      description: "返信の監視とレポート機能",
      icon: BarChart3,
      path: "/reply-monitoring",
      color: "from-red-500 to-pink-500",
      bgGradient: "from-red-50 to-pink-50",
      borderColor: "border-red-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "設定",
      description: "アカウント設定とAPIキー管理",
      icon: Settings,
      path: "/settings",
      color: "from-gray-500 to-slate-500",
      bgGradient: "from-gray-50 to-slate-50",
      borderColor: "border-gray-200",
      disabled: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section with Enhanced Design */}
        <div className="text-center space-y-6 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Threads-Genius AI
              </h1>
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              </div>
            </div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              <span className="font-semibold text-blue-600">Gemini搭載</span>次世代AI自動運用プラットフォーム
              <br />
              <span className="text-lg">🚀 革新的なThreads運用体験を提供</span>
            </p>
          </div>
        </div>

        <AccountStatusBanner />

        {/* Enhanced Admin Section */}
        {isAdmin && (
          <Card className="border-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 shadow-2xl">
            <div className="bg-white/90 backdrop-blur-sm m-1 rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-800">
                  <div className="p-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  管理者機能
                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                    ADMIN
                  </Badge>
                </CardTitle>
                <CardDescription className="text-gray-600 text-lg">
                  ユーザーアカウントの管理とシステム設定
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate("/admin")}
                  className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  size="lg"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  管理者ダッシュボード
                  <Rocket className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </div>
          </Card>
        )}

        {/* Enhanced Feature Cards */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={feature.title} 
                className={`group relative overflow-hidden border-0 bg-gradient-to-br ${feature.bgGradient} shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105 ${
                  feature.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
                onClick={() => !feature.disabled && navigate(feature.path)}
              >
                {/* Gradient Border */}
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} p-0.5 rounded-xl`}>
                  <div className="bg-white rounded-lg h-full w-full"></div>
                </div>
                
                {/* Content */}
                <div className="relative z-10 h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-4 text-xl">
                      <div className={`p-3 bg-gradient-to-r ${feature.color} rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-800 font-bold">{feature.title}</span>
                          {feature.disabled && (
                            <Badge variant="secondary" className="text-xs bg-gray-200">
                              無効
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-base leading-relaxed ml-16">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button 
                      variant="outline" 
                      className={`w-full h-12 border-2 font-semibold transition-all duration-300 ${
                        feature.disabled 
                          ? 'border-gray-300 text-gray-400' 
                          : `border-transparent bg-gradient-to-r ${feature.color} text-white hover:shadow-lg hover:scale-105`
                      }`}
                      disabled={feature.disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!feature.disabled) navigate(feature.path);
                      }}
                    >
                      {feature.disabled ? (
                        <>
                          <span>アクセス不可</span>
                        </>
                      ) : (
                        feature.title === "ペルソナ設定" ? (
                          <span className="flex items-center gap-2">
                            <Edit className="h-4 w-4" />
                            設定・編集
                            <Sparkles className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            開始する
                            <Rocket className="h-4 w-4" />
                          </span>
                        )
                      )}
                    </Button>
                  </CardContent>
                </div>

                {/* Hover Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              </Card>
            );
          })}
        </div>

        {/* Enhanced Advertisement Section */}
        <div className="space-y-8">
          <div className="text-center relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 via-blue-400/20 to-purple-400/20 rounded-2xl blur-2xl"></div>
            <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                💰 収益化加速ツール 💰
              </h2>
              <p className="text-gray-600 text-lg">
                AIを使った最新の収益化手法をご紹介
              </p>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
            {/* 恋愛ジャンル広告 */}
            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400 p-0.5 rounded-xl">
                <div className="bg-white rounded-lg h-full w-full"></div>
              </div>
              <div className="relative z-10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-pink-800">
                    <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg">
                      <Heart className="h-6 w-6 text-white" />
                    </div>
                    恋愛ジャンル攻略法
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-pink-500 fill-pink-500" />
                      <Star className="h-4 w-4 text-pink-500 fill-pink-500" />
                      <Star className="h-4 w-4 text-pink-500 fill-pink-500" />
                    </div>
                  </CardTitle>
                  <CardDescription className="text-pink-700 font-semibold text-lg">
                    「恋愛ジャンルはもう飽和」と思ってません？
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-pink-200 shadow-lg">
                    <p className="text-gray-800 font-bold text-lg mb-3">
                      まだまだ稼ぎ放題なんです。
                    </p>
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      しかも、AIが勝手にネタ・コピーを全部作成。<br/>
                      あなたは投稿ボタンを押すだけ。
                    </p>
                    <div className="flex items-center gap-3 text-pink-600 bg-pink-50 rounded-lg p-3">
                      <Sparkles className="h-5 w-5" />
                      <span className="font-semibold">完全自動化システム</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full h-12 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    asChild
                  >
                    <a 
                      href="https://note.com/mido_renai/n/n9a3cdcc9dc4f" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-lg font-semibold"
                    >
                      <ExternalLink className="h-5 w-5" />
                      恋愛ジャンル攻略法を見る
                      <Rocket className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </div>
            </Card>

            {/* ドスケベライティング広告 */}
            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-red-50 via-orange-50 to-red-100 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-orange-400 p-0.5 rounded-xl">
                <div className="bg-white rounded-lg h-full w-full"></div>
              </div>
              <div className="relative z-10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-red-800">
                    <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    AIライティング革命
                    <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
                      NEW
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-red-700 font-semibold text-lg">
                    「エロが書けないAI」はもう時代遅れ。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-red-200 shadow-lg">
                    <p className="text-gray-800 font-bold text-lg mb-4">
                      AIで"売れるドスケベ文章"を量産可能に
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">売れるドスケベライティングをAIで爆速生成</span>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">心理学×FOMOを駆使して購買意欲を最大化</span>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">今ならまだ誰も知らない、先行者利益を独占！</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full h-12 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    asChild
                  >
                    <a 
                      href="https://deeps.me/u/mountain_cb/a/ChatGPTHack" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-lg font-semibold"
                    >
                      <ExternalLink className="h-5 w-5" />
                      AIライティング手法を確認する
                      <Zap className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </div>
            </Card>
          </div>

          {/* バズポストGPTs広告（大きく表示） */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-102">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-400 p-0.5 rounded-xl">
              <div className="bg-white rounded-lg h-full w-full"></div>
            </div>
            <div className="relative z-10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl text-purple-800">
                  <div className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg">
                    <TrendingUp className="h-8 w-8 text-white" />
                  </div>
                  バズった裏垢女子ポストを大量学習済み
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 text-purple-500 fill-purple-500" />
                    <Star className="h-5 w-5 text-purple-500 fill-purple-500" />
                    <Star className="h-5 w-5 text-purple-500 fill-purple-500" />
                    <Star className="h-5 w-5 text-purple-500 fill-purple-500" />
                    <Star className="h-5 w-5 text-purple-500 fill-purple-500" />
                  </div>
                </CardTitle>
                <CardDescription className="text-purple-700 font-bold text-xl">
                  やばいGPTsができました - アダアフィ垢バズポスト自動生成GPTs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-purple-200 shadow-lg">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="text-3xl">👱</div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-semibold text-lg mb-2">
                        <strong>アダアフィってめっちゃ稼げるよね</strong>
                      </p>
                      <p className="text-gray-700">
                        そうなんだよね、でもさ...
                      </p>
                    </div>
                    <div className="text-3xl">🧔</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                      <span className="text-2xl">😤</span>
                      こんなお悩みありませんか？
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-gray-700 font-medium">
                          ■ アダアフィやってみたいけど上手にポストが作れずインプが😭
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-gray-700 font-medium">
                          ■ 毎日継続してポスト作成できず結局利益が出ずに諦めてしまった
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-gray-700 font-medium">
                          ■ そもそもターゲットに刺さるポストが作れない😡
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-gray-700 font-medium">
                          ■ 生成AIでポスト作成を試みるもうまく生成できない、プロンプトも難しくて結局挫折🙇‍♂️
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-100 via-orange-100 to-yellow-100 rounded-xl p-6 border-2 border-orange-200 shadow-lg">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-xl">
                      <span className="text-2xl">💎</span>
                      そんなあなたへ
                    </h4>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start gap-3 bg-white/80 rounded-lg p-4 shadow-sm">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">
                          <strong>複雑なプロンプトは一切不要！</strong><br/>
                          超簡単な指示でバズるポストを大量生成
                        </span>
                      </div>
                      <div className="flex items-start gap-3 bg-white/80 rounded-lg p-4 shadow-sm">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">
                          半年以上かけてリサーチした大量のバズポストをGPTsに学習済み
                        </span>
                      </div>
                      <div className="flex items-start gap-3 bg-white/80 rounded-lg p-4 shadow-sm">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">
                          完全脳死で作業しても勝手にクオリティの高いポストを自動生成
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-purple-700 font-bold text-lg mb-4 flex items-center justify-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        バズるポストが簡単に作れる秘密の方法👇
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full h-16 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-700 text-white text-xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                  asChild
                >
                  <a 
                    href="https://deeps.me/u/mountain_cb/a/bazzpostGPTs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3"
                  >
                    <Crown className="h-6 w-6" />
                    やばいGPTsの詳細を確認する
                    <Rocket className="h-5 w-5" />
                  </a>
                </Button>
              </CardContent>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
