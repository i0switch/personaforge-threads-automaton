
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, Eye, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SecurityEvent {
  id: string;
  user_id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata: any;
}

export const SecurityEventMonitor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSecurityEvents();
    }
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchSecurityEvents();
      }, 30000); // 30秒間隔で更新
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh]);

  const fetchSecurityEvents = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .in('action_type', [
          'admin_check_failed',
          'unauthorized_admin_access',
          'admin_access_granted',
          'security_setting_changed',
          'login_failed',
          'login_success',
          'account_locked'
        ])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching security events:', error);
      toast({
        title: "エラー",
        description: "セキュリティイベントの取得に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventSeverity = (actionType: string) => {
    const severityMap: Record<string, 'high' | 'medium' | 'low'> = {
      'admin_check_failed': 'high',
      'unauthorized_admin_access': 'high',
      'admin_access_granted': 'medium',
      'security_setting_changed': 'medium',
      'login_failed': 'low',
      'login_success': 'low',
      'account_locked': 'high'
    };
    return severityMap[actionType] || 'low';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'outline';
    }
  };

  const getEventIcon = (actionType: string) => {
    if (actionType.includes('admin') || actionType.includes('unauthorized')) {
      return <Shield className="h-4 w-4" />;
    }
    if (actionType.includes('login') || actionType.includes('locked')) {
      return <Eye className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const formatEventTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  const getEventDescription = (event: SecurityEvent) => {
    const descriptions: Record<string, string> = {
      'admin_check_failed': '管理者権限確認エラー',
      'unauthorized_admin_access': '不正な管理者アクセス試行',
      'admin_access_granted': '管理者エリアアクセス許可',
      'security_setting_changed': 'セキュリティ設定変更',
      'login_failed': 'ログイン失敗',
      'login_success': 'ログイン成功',
      'account_locked': 'アカウントロック'
    };
    return descriptions[event.action_type] || event.description;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>セキュリティイベント監視</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">読み込み中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const highSeverityEvents = events.filter(e => getEventSeverity(e.action_type) === 'high');
  const recentEvents = events.filter(e => 
    new Date(e.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              セキュリティイベント監視
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <Clock className="h-4 w-4 mr-2" />
                {autoRefresh ? '自動更新ON' : '自動更新OFF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSecurityEvents}
              >
                更新
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {highSeverityEvents.length}
              </div>
              <div className="text-sm text-red-600">高リスクイベント</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {recentEvents.length}
              </div>
              <div className="text-sm text-blue-600">24時間以内</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {events.length}
              </div>
              <div className="text-sm text-gray-600">総イベント数</div>
            </div>
          </div>

          {highSeverityEvents.length > 0 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>注意:</strong> {highSeverityEvents.length}件の高リスクセキュリティイベントが検出されています。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近のセキュリティイベント</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                セキュリティイベントがありません
              </p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getEventIcon(event.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {getEventDescription(event)}
                      </span>
                      <Badge variant={getSeverityColor(getEventSeverity(event.action_type))}>
                        {getEventSeverity(event.action_type).toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatEventTime(event.created_at)}</span>
                      {event.metadata?.ip && (
                        <span>IP: {event.metadata.ip}</span>
                      )}
                      {event.metadata?.path && (
                        <span>Path: {event.metadata.path}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
