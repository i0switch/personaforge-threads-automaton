
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ActivityLog {
  id: string;
  action_type: string;
  description: string;
  metadata: any;
  created_at: string;
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
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[ActivityLogs] supabase error', error);
        setLogs([]);
        return;
      }
      setLogs(Array.isArray(data) ? data : []);
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
        return 'AI自動返信';
      case 'post_created':
        return '投稿作成';
      case 'post_published':
        return '投稿公開';
      default:
        return actionType;
    }
  };

  const getActionTypeBadgeVariant = (actionType: string) => {
    switch (actionType) {
      case 'auto_reply_sent':
        return 'default';
      case 'post_created':
        return 'secondary';
      case 'post_published':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading && logs.length === 0) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>アクティビティログ</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-gray-500">まだアクティビティがありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>ペルソナ</TableHead>
                  <TableHead>アクション</TableHead>
                  <TableHead>説明</TableHead>
                  <TableHead>詳細</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs ?? []).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.personas?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionTypeBadgeVariant(log.action_type)}>
                        {getActionTypeLabel(log.action_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.description}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.metadata && (
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 hover:text-blue-800">
                            詳細を見る
                          </summary>
                          <div className="mt-2 space-y-2 max-w-xs">
                            {Object.entries(log.metadata as Record<string, any>).map(([key, value]) => (
                              <div key={key} className="bg-gray-50 p-2 rounded text-xs">
                                <div className="font-semibold text-gray-700 mb-1">
                                  {key === 'reply_id' ? 'リプライID' :
                                   key === 'reply_text' ? 'リプライ内容' :
                                   key === 'author' ? '投稿者' :
                                   key === 'threads_id' ? 'Threads ID' :
                                   key === 'generated_reply' ? 'AI返信内容' :
                                   key === 'reply_to' ? '返信先内容' :
                                   key === 'original_post' ? '元投稿' :
                                   key}:
                                </div>
                                <div className="text-gray-600 break-words">
                                  {typeof value === 'string' ? (
                                    value.length > 100 ? `${value.substring(0, 100)}...` : value
                                  ) : (
                                    JSON.stringify(value, null, 2)
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export { ActivityLogs as default };
