
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, Users, Settings, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserManagementTable } from "@/components/Admin/UserManagementTable";
import { AdminStats } from "@/components/Admin/AdminStats";
import { PersonaLimitManager } from "@/components/Admin/PersonaLimitManager";
import { MonitoringDashboard } from "@/components/Admin/MonitoringDashboard";

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

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              ユーザー管理
            </TabsTrigger>
            <TabsTrigger value="persona-limits" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              ペルソナ上限管理
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              システム監視
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
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
          </TabsContent>

          <TabsContent value="persona-limits">
            <PersonaLimitManager />
          </TabsContent>

          <TabsContent value="monitoring">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  システム監視
                </CardTitle>
                <CardDescription>
                  ペルソナ設定とスケジューリングシステムの状況監視
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MonitoringDashboard />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
