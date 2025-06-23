
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReplySettings } from '@/components/ReplyMonitoring/ReplySettings';
import { ReplyList } from '@/components/ReplyMonitoring/ReplyList';

const ReplyMonitoring = () => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">リプライ監視</h1>
      
      <Tabs defaultValue="replies" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="replies">リプライ一覧</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>
        
        <TabsContent value="replies" className="mt-6">
          <ReplyList />
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <ReplySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReplyMonitoring;
