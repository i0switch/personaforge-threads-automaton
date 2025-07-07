
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityConfigPanel } from "./SecurityConfigPanel";
import { SecurityScanPanel } from "./SecurityScanPanel";
import { SecurityEventMonitor } from "./SecurityEventMonitor";
import { ZapScanResults } from "./ZapScanResults";

export const SecuritySettings = () => {
  return (
    <div className="space-y-6">
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
