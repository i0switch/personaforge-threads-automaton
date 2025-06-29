
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SchedulingSettings } from "@/components/Scheduling/SchedulingSettings";
import { PostQueue } from "@/components/Scheduling/PostQueue";
import { AutoScheduler } from "@/components/Scheduling/AutoScheduler";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

const SchedulingDashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("SchedulingDashboard mounted - user:", user, "loading:", loading);
    
    if (!loading) {
      if (!user) {
        console.log("No user found in SchedulingDashboard");
        setError("ログインが必要です。");
      } else {
        console.log("User authenticated in SchedulingDashboard:", user.id);
        setError(null);
      }
      setIsLoading(false);
    }
  }, [user, loading]);

  console.log("SchedulingDashboard render - user:", !!user, "loading:", loading, "isLoading:", isLoading, "error:", error);

  // 初期ローディング状態
  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">読み込み中...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // エラー状態または未認証
  if (error || !user) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
            <h1 className="text-3xl font-bold">スケジューリング管理</h1>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                {error || "ログインが必要です。"}
              </p>
              {!user && (
                <div className="text-center mt-4">
                  <Button onClick={() => navigate("/auth")}>
                    ログインページへ
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // メインコンテンツ
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">スケジューリング管理</h1>
            <p className="text-muted-foreground">
              自動投稿・キュー管理・リトライ設定
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <SchedulingSettings />
            <AutoScheduler />
          </div>
          <div>
            <PostQueue />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulingDashboard;
