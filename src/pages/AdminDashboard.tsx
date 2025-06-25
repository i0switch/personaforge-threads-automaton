
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserManagementTable } from "@/components/Admin/UserManagementTable";
import { AdminStats } from "@/components/Admin/AdminStats";

const AdminDashboard = () => {
  const navigate = useNavigate();

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
