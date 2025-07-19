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
      color: "from-slate-600 to-slate-700",
      bgGradient: "from-slate-50 to-gray-50",
      borderColor: "border-slate-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "投稿作成",
      description: "AIを使って魅力的な投稿を生成",
      icon: MessageSquare,
      path: "/create-posts",
      color: "from-emerald-600 to-teal-700",
      bgGradient: "from-emerald-50 to-teal-50",
      borderColor: "border-emerald-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "スケジュール管理",
      description: "投稿の予約と自動投稿設定",
      icon: Calendar,
      path: "/scheduled-posts",
      color: "from-indigo-600 to-purple-700",
      bgGradient: "from-indigo-50 to-purple-50",
      borderColor: "border-indigo-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "自動返信",
      description: "コメントへの自動返信機能",
      icon: Bot,
      path: "/auto-reply",
      color: "from-amber-600 to-orange-700",
      bgGradient: "from-amber-50 to-orange-50",
      borderColor: "border-amber-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "返信監視",
      description: "返信の監視とレポート機能",
      icon: BarChart3,
      path: "/reply-monitoring",
      color: "from-rose-600 to-pink-700",
      bgGradient: "from-rose-50 to-pink-50",
      borderColor: "border-rose-200",
      disabled: !isApproved || !isActive
    },
    {
      title: "設定",
      description: "アカウント設定とAPIキー管理",
      icon: Settings,
      path: "/settings",
      color: "from-gray-600 to-slate-700",
      bgGradient: "from-gray-50 to-slate-50",
      borderColor: "border-gray-200",
      disabled: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-stone-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section with Enhanced Design */}
        <div className="text-center space-y-6 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-600/5 via-indigo-600/5 to-gray-600/5 rounded-3xl blur-3xl"></div>
          <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-slate-200/50">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-slate-700 to-gray-800 rounded-2xl shadow-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-700 via-gray-800 to-slate-900 bg-clip-text text-transparent">
                Threads-Genius AI
              </h1>
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              </div>
            </div>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              <span className="font-semibold text-slate-700">Gemini搭載</span>次世代AI自動運用プラットフォーム
              <br />
              <span className="text-lg">🚀 革新的なThreads運用体験を提供</span>
            </p>
          </div>
        </div>

        <AccountStatusBanner />

        {/* Enhanced Admin Section */}
        {isAdmin && (
          <Card className="border-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 shadow-2xl">
            <div className="bg-white/95 backdrop-blur-sm m-1 rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-800">
                  <div className="p-2 bg-gradient-to-r from-amber-600 to-orange-600 rounded-lg">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  管理者機能
                  <Badge className="bg-gradient-to-r from-amber-600 to-orange-600 text-white">
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
                  className="bg-gradient-to-r from-amber-700 to-orange-700 hover:from-amber-800 hover:to-orange-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
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
                className={`group relative overflow-hidden border-0 bg-gradient-to-br ${feature.bgGradient} shadow-lg hover:shadow-xl transition-all duration-500 transform hover:scale-105 ${
                  feature.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
                onClick={() => !feature.disabled && navigate(feature.path)}
              >
                {/* Subtle Border */}
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} p-0.5 rounded-xl opacity-20`}>
                  <div className="bg-white rounded-lg h-full w-full"></div>
                </div>
                
                {/* Content */}
                <div className="relative z-10 h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-4 text-xl">
                      <div className={`p-3 bg-gradient-to-r ${feature.color} rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300`}>
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
                      className={`w-full h-12 border-2 font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                        feature.disabled 
                          ? 'border-gray-300 text-gray-400 bg-white' 
                          : `border-transparent bg-gradient-to-r ${feature.color} text-white hover:shadow-md hover:scale-105`
                      }`}
                      disabled={feature.disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!feature.disabled) navigate(feature.path);
                      }}
                    >
                      {feature.disabled ? (
                        <>
                          アクセス不可
                        </>
                      ) : (
                        feature.title === "ペルソナ設定" ? (
                          <>
                            <Edit className="h-4 w-4" />
                            設定・編集
                            <Sparkles className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            開始する
                            <Rocket className="h-4 w-4" />
                          </>
                        )
                      )}
                    </Button>
                  </CardContent>
                </div>

                {/* Subtle Hover Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              </Card>
            );
          })}
        </div>

        {/* サポート・更新機能通知 & 新機能アピール */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* サポート・更新機能通知用オープンチャット */}
          <Card className="border-0 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 shadow-xl">
            <div className="bg-white/95 backdrop-blur-sm m-1 rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-3 text-gray-800">
                  <div className="p-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  サポート・更新機能通知用
                  <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                    LINE
                  </Badge>
                </CardTitle>
                <CardDescription className="text-gray-600 text-base text-center">
                  「Threads-Genius AI利用者専用」
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <a 
                  href="https://line.me/ti/g2/8PfsRrm8_msOUgclDBgrYtY3Nm-uz5focauD1A?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block transition-transform hover:scale-105"
                >
                  <img 
                    src="/lovable-uploads/17adfadd-e520-4fe6-bb3d-50e82ffa1967.png" 
                    alt="LINE オープンチャット QRコード" 
                    className="w-32 h-32 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                  />
                </a>
                <Button 
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  asChild
                >
                  <a 
                    href="https://line.me/ti/g2/8PfsRrm8_msOUgclDBgrYtY3Nm-uz5focauD1A?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    オープンチャットに参加
                  </a>
                </Button>
              </CardContent>
            </div>
          </Card>

          {/* 新機能アピール：遅延返信設定 */}
          <Card className="border-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 shadow-xl">
            <div className="bg-white/95 backdrop-blur-sm m-1 rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-3 text-gray-800">
                  <div className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  AI自動返信機能 アップデート
                  <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white animate-pulse">
                    NEW
                  </Badge>
                </CardTitle>
                <CardDescription className="text-gray-600 text-base text-center">
                  遅延返信設定機能を追加しました
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-purple-200 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-gray-800 font-bold text-base mb-2">
                        より人間らしく返信できます
                      </p>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        返信までの時間を設定することで、自然な会話のリズムを演出。即座に返信するのではなく、人間らしい間を作ることができます。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-purple-700 bg-purple-50 rounded-lg p-3">
                    <Sparkles className="h-5 w-5" />
                    <span className="font-semibold text-sm">0〜60分まで自由に設定可能</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full h-10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                  onClick={() => navigate("/auto-reply")}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  自動返信設定を確認
                  <Sparkles className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </div>
          </Card>
        </div>

        {/* Enhanced Advertisement Section */}
        <div className="space-y-8">
          <div className="text-center relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-slate-400/10 to-indigo-400/10 rounded-2xl blur-2xl"></div>
            <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-700 via-slate-800 to-indigo-700 bg-clip-text text-transparent mb-3">
                💰 収益化加速ツール 💰
              </h2>
              <p className="text-gray-700 text-lg">
                AIを使った最新の収益化手法をご紹介
              </p>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
            {/* 恋愛ジャンル広告 */}
            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:scale-102">
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-pink-600 p-0.5 rounded-xl opacity-20">
                <div className="bg-white rounded-lg h-full w-full"></div>
              </div>
              <div className="relative z-10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-rose-800">
                    <div className="p-2 bg-gradient-to-r from-rose-600 to-pink-600 rounded-lg">
                      <Heart className="h-6 w-6 text-white" />
                    </div>
                    恋愛ジャンル攻略法
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-rose-500 fill-rose-500" />
                      <Star className="h-4 w-4 text-rose-500 fill-rose-500" />
                      <Star className="h-4 w-4 text-rose-500 fill-rose-500" />
                    </div>
                  </CardTitle>
                  <CardDescription className="text-rose-700 font-semibold text-lg">
                    「恋愛ジャンルはもう飽和」と思ってません？
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-rose-200 shadow-sm">
                    <p className="text-gray-800 font-bold text-lg mb-3">
                      まだまだ稼ぎ放題なんです。
                    </p>
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      しかも、AIが勝手にネタ・コピーを全部作成。<br/>
                      あなたは投稿ボタンを押すだけ。
                    </p>
                    <div className="flex items-center gap-3 text-rose-700 bg-rose-50 rounded-lg p-3">
                      <Sparkles className="h-5 w-5" />
                      <span className="font-semibold">完全自動化システム</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full h-12 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
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
            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:scale-102">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-600 p-0.5 rounded-xl opacity-20">
                <div className="bg-white rounded-lg h-full w-full"></div>
              </div>
              <div className="relative z-10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-orange-800">
                    <div className="p-2 bg-gradient-to-r from-orange-600 to-amber-600 rounded-lg">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    AIライティング革命
                    <Badge className="bg-gradient-to-r from-orange-600 to-amber-600 text-white">
                      NEW
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-orange-700 font-semibold text-lg">
                    「エロが書けないAI」はもう時代遅れ。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-orange-200 shadow-sm">
                    <p className="text-gray-800 font-bold text-lg mb-4">
                      AIで"売れるドスケベ文章"を量産可能に
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">売れるドスケベライティングをAIで爆速生成</span>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">心理学×FOMOを駆使して購買意欲を最大化</span>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">今ならまだ誰も知らない、先行者利益を独占！</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full h-12 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
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
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-101">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-slate-700 to-indigo-600 p-0.5 rounded-xl opacity-15">
              <div className="bg-white rounded-lg h-full w-full"></div>
            </div>
            <div className="relative z-10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl text-indigo-800">
                  <div className="p-3 bg-gradient-to-r from-indigo-700 to-slate-800 rounded-xl shadow-lg">
                    <TrendingUp className="h-8 w-8 text-white" />
                  </div>
                  バズった裏垢女子ポストを大量学習済み
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  </div>
                </CardTitle>
                <CardDescription className="text-indigo-700 font-bold text-xl">
                  やばいGPTsができました - アダアフィ垢バズポスト自動生成GPTs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-indigo-200 shadow-sm">
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

                  <div className="bg-gradient-to-br from-amber-100 via-yellow-100 to-amber-100 rounded-xl p-6 border-2 border-amber-200 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-xl">
                      <span className="text-2xl">💎</span>
                      そんなあなたへ
                    </h4>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start gap-3 bg-white/90 rounded-lg p-4 shadow-sm">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">
                          <strong>複雑なプロンプトは一切不要！</strong><br/>
                          超簡単な指示でバズるポストを大量生成
                        </span>
                      </div>
                      <div className="flex items-start gap-3 bg-white/90 rounded-lg p-4 shadow-sm">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">
                          半年以上かけてリサーチした大量のバズポストをGPTsに学習済み
                        </span>
                      </div>
                      <div className="flex items-start gap-3 bg-white/90 rounded-lg p-4 shadow-sm">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <span className="text-gray-700 font-medium">
                          完全脳死で作業しても勝手にクオリティの高いポストを自動生成
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-indigo-700 font-bold text-lg mb-4 flex items-center justify-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        バズるポストが簡単に作れる秘密の方法👇
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full h-16 bg-gradient-to-r from-indigo-700 via-slate-800 to-indigo-700 hover:from-indigo-800 hover:via-slate-900 hover:to-indigo-800 text-white text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
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
