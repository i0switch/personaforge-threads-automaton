
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
  Image,
  BarChart3,
  Shield,
  Edit,
  Zap,
  ExternalLink,
  CheckCircle,
  Crown
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
      disabled: false // 設定は常にアクセス可能
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
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

        <Card className="border-red-200 bg-gradient-to-r from-red-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <Crown className="h-5 w-5" />
              バズった裏垢女子ポストを大量学習済み
            </CardTitle>
            <CardDescription className="text-red-700 font-medium">
              やばいGPTsができました - アダアフィ垢バズポスト自動生成GPTs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/60 rounded-lg p-4 border border-red-100">
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
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-700">
                    <strong>複雑なプロンプトは一切不要！</strong><br/>
                    超簡単な指示でバズるポストを大量生成
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-700">
                    半年以上かけてリサーチした大量のバズポストをGPTsに学習済み
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-700">
                    完全脳死で作業しても勝手にクオリティの高いポストを自動生成
                  </span>
                </div>
              </div>
              
              <p className="text-red-700 font-medium text-center">
                バズるポストが簡単に作れる秘密の方法👇
              </p>
            </div>
            
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              asChild
            >
              <a 
                href="https://deeps.me/u/mountain_cb/a/bazzpostGPTs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                やばいGPTsの詳細を確認する
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
