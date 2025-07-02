
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActivityLog {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata: any;
  personas: {
    name: string;
  } | null;
}

export const ActivityLogs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          personas (
            name
          )
        `)
        .eq('user_id', user!.id)
        .in('action_type', ['auto_reply_sent', 'reply_received', 'webhook_received'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast({
        title: 'エラー',
        description: 'アクティビティログの取得に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionTypeLabel = (actionType: string) => {
    switch (actionType) {
      case 'auto_reply_sent':
        return '自動返信送信';
      case 'reply_received':
        return 'リプライ受信';
      case 'webhook_received':
        return 'Webhook受信';
      default:
        return actionType;
    }
  };

  const getActionTypeBadgeVariant = (actionType: string) => {
    switch (actionType) {
      case 'auto_reply_sent':
        return 'default';
      case 'reply_received':
        return 'secondary';
      case 'webhook_received':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>アクティビティログ</span>
            <Button onClick={fetchLogs} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              更新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">アクティビティログはありません</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={getActionTypeBadgeVariant(log.action_type)}>
                        {getActionTypeLabel(log.action_type)}
                      </Badge>
                      {log.personas && (
                        <Badge variant="outline">
                          {log.personas.name}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  
                  {log.description && (
                    <p className="text-gray-700 mb-2">{log.description}</p>
                  )}
                  
                  {log.metadata && (
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">
                        詳細情報を表示
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
