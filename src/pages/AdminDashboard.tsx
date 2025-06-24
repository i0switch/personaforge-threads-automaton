
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Users, UserCheck, UserX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserManagementTable } from "@/components/Admin/UserManagementTable";
import { AdminStats } from "@/components/Admin/AdminStats";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
      
      if (error) throw error;
      
      if (!data) {
        toast({
          title: "アクセス拒否",
          description: "管理者権限が必要です。",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      
      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin status:', error);
      toast({
        title: "エラー",
        description: "権限確認に失敗しました。",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <span>読み込み中...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              管理者ダッシュボード
            </h1>
            <p className="text-muted-foreground">
              ユーザーアカウントとシステムの管理
            </p>
          </div>
        </div>

        <AdminStats />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              ユーザー管理
            </CardTitle>
            <CardDescription>
              ユーザーアカウントの承認、有効化/無効化、課金ステータスの管理
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserManagementTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
