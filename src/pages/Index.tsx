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
  Edit
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
            AI SNS Assistant
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AIを活用してSNSの投稿作成、スケジュール管理、自動返信を効率化しましょう
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

        <Card>
          <CardHeader>
            <CardTitle>はじめに</CardTitle>
            <CardDescription>
              AI SNS Assistantを最大限活用するための手順
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-semibold">1. ペルソナを設定</h3>
                <p className="text-sm text-muted-foreground">
                  まずはAIアシスタントの性格や専門分野を設定しましょう。既存のペルソナがある場合は編集も可能です。
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">2. 投稿を作成</h3>
                <p className="text-sm text-muted-foreground">
                  AIを使って魅力的な投稿コンテンツを生成します
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">3. スケジュール設定</h3>
                <p className="text-sm text-muted-foreground">
                  最適なタイミングで投稿を自動化しましょう
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">4. 自動返信を活用</h3>
                <p className="text-sm text-muted-foreground">
                  コメントへの返信を自動化してエンゲージメントを向上
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
