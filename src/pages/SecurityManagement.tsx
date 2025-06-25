
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityDashboard } from "@/components/Security/SecurityDashboard";
import { SecuritySettings } from "@/components/Security/SecuritySettings";
import { SecurityActivityLogs } from "@/components/Security/SecurityActivityLogs";
import { SecurityAuditReport } from "@/components/Security/SecurityAuditReport";

const SecurityManagement = () => {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">セキュリティ管理</h1>
        <p className="text-muted-foreground mt-2">
          システムのセキュリティ状況を監視し、設定を管理します
        </p>
      </div>

      <Tabs defaultValue="audit" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="audit">監査レポート</TabsTrigger>
          <TabsTrigger value="dashboard">ダッシュボード</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
          <TabsTrigger value="logs">活動ログ</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <SecurityAuditReport />
        </TabsContent>

        <TabsContent value="dashboard">
          <SecurityDashboard />
        </TabsContent>

        <TabsContent value="settings">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="logs">
          <SecurityActivityLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityManagement;
