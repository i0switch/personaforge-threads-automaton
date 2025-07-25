
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ReplySettings } from '@/components/ReplyMonitoring/ReplySettings';
import { PersonaReplyList } from '@/components/ReplyMonitoring/PersonaReplyList';
import { PersonaWebhookSettings } from '@/components/ReplyMonitoring/PersonaWebhookSettings';
import { ActivityLogs } from '@/components/ReplyMonitoring/ActivityLogs';
import { AutoReplyTester } from '@/components/AutoReplyTester';

const ReplyMonitoring = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>
        <h1 className="text-3xl font-bold">リプライ監視</h1>
      </div>
      
      <Tabs defaultValue="replies" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="replies">リプライ一覧</TabsTrigger>
          <TabsTrigger value="logs">アクティビティログ</TabsTrigger>
          <TabsTrigger value="webhook">Webhook設定</TabsTrigger>
          <TabsTrigger value="settings">監視設定</TabsTrigger>
          <TabsTrigger value="test">テスト</TabsTrigger>
        </TabsList>
        
        <TabsContent value="replies" className="mt-6">
          <PersonaReplyList />
        </TabsContent>
        
        <TabsContent value="logs" className="mt-6">
          <ActivityLogs />
        </TabsContent>
        
        <TabsContent value="webhook" className="mt-6">
          <PersonaWebhookSettings />
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <ReplySettings />
        </TabsContent>
        
        <TabsContent value="test" className="mt-6">
          <AutoReplyTester />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReplyMonitoring;
