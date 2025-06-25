
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityDashboard } from "@/components/Security/SecurityDashboard";
import { SecuritySettings } from "@/components/Security/SecuritySettings";
import { SecurityActivityLogs } from "@/components/Security/SecurityActivityLogs";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const SecurityManagement = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard">ダッシュボード</TabsTrigger>
              <TabsTrigger value="settings">設定</TabsTrigger>
              <TabsTrigger value="logs">アクティビティログ</TabsTrigger>
            </TabsList>
            
            <TabsContent value="dashboard" className="space-y-6">
              <SecurityDashboard />
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-6">
              <SecuritySettings />
            </TabsContent>
            
            <TabsContent value="logs" className="space-y-6">
              <SecurityActivityLogs />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default SecurityManagement;
