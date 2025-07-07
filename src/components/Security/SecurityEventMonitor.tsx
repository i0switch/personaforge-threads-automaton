
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, AlertTriangle, RefreshCw, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: any;
  created_at: string;
}

export const SecurityEventMonitor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      loadSecurityEvents();
      setupRealTimeMonitoring();
    }

    return () => {
      if (realTimeEnabled) {
        // クリーンアップは自動で行われる
      }
    };
  }, [user]);

  const loadSecurityEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Failed to load security events:', error);
      toast({
        title: "エラー",
        description: "セキュリティイベントの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeMonitoring = () => {
    if (!user || realTimeEnabled) return;

    const channel = supabase
      .channel('security-events-monitor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_events'
        },
        (payload) => {
          const newEvent = payload.new as SecurityEvent;
          setEvents(prev => [newEvent, ...prev.slice(0, 49)]);
          
          // 重要なイベントの場合は通知
          if (newEvent.event_type.includes('failed') || newEvent.event_type.includes('unauthorized')) {
            toast({
              title: "セキュリティアラート",
              description: `新しいセキュリティイベント: ${newEvent.event_type}`,
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    setRealTimeEnabled(true);
  };

  const getEventBadgeColor = (eventType: string) => {
    if (eventType.includes('failed') || eventType.includes('unauthorized')) {
      return 'destructive';
    }
    if (eventType.includes('success') || eventType.includes('granted')) {
      return 'default';
    }
    return 'secondary';
  };

  const formatEventType = (eventType: string) => {
    const translations: Record<string, string> = {
      'login_success': 'ログイン成功',
      'login_failed': 'ログイン失敗',
      'admin_access_granted': '管理者アクセス許可',
      'unauthorized_admin_access': '不正な管理者アクセス',
      'security_setting_changed': 'セキュリティ設定変更',
      'security_scan_executed': 'セキュリティスキャン実行',
      'api_request': 'API リクエスト'
    };
    return translations[eventType] || eventType;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            セキュリティイベント監視
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            セキュリティイベント監視
          </div>
          <div className="flex items-center gap-2">
            {realTimeEnabled && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                リアルタイム監視中
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={loadSecurityEvents}>
              <RefreshCw className="h-4 w-4 mr-1" />
              更新
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              セキュリティイベントはありません。
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>イベントタイプ</TableHead>
                <TableHead>詳細</TableHead>
                <TableHead>IPアドレス</TableHead>
                <TableHead>発生時刻</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Badge variant={getEventBadgeColor(event.event_type)}>
                      {formatEventType(event.event_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {event.details?.email || event.details?.action || event.details?.description || '-'}
                  </TableCell>
                  <TableCell>{event.ip_address || '-'}</TableCell>
                  <TableCell>
                    {new Date(event.created_at).toLocaleString('ja-JP')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
