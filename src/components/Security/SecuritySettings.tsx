
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityConfigPanel } from "./SecurityConfigPanel";
import { SecurityScanPanel } from "./SecurityScanPanel";
import { SecurityEventMonitor } from "./SecurityEventMonitor";
import { ZapScanResults } from "./ZapScanResults";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const SecuritySettings = () => {
  return (
    <div className="space-y-6">
      {/* セキュリティステータス概要 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            セキュリティステータス
          </CardTitle>
          <CardDescription>
            システムの現在のセキュリティ状況
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">RLS有効化完了</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">入力値検証強化</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">監視中</span>
            </div>
          </div>
          
          <Alert className="mt-4">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              セキュリティ修正が適用されました。継続的な監視とアップデートを推奨します。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">設定</TabsTrigger>
          <TabsTrigger value="scan">スキャン</TabsTrigger>
          <TabsTrigger value="events">イベント監視</TabsTrigger>
          <TabsTrigger value="zap">ZAPスキャン</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <SecurityConfigPanel />
        </TabsContent>

        <TabsContent value="scan">
          <SecurityScanPanel />
        </TabsContent>

        <TabsContent value="events">
          <SecurityEventMonitor />
        </TabsContent>

        <TabsContent value="zap">
          <ZapScanResults />
        </TabsContent>
      </Tabs>
    </div>
  );
};
