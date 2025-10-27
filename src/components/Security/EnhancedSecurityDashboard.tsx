
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, Eye, Clock, Activity, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { enhancedSecurity } from "@/utils/enhancedSecurity";

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: any;
  created_at: string;
}

export const EnhancedSecurityDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    criticalEvents: 0,
    loginAttempts: 0,
    adminAccess: 0
  });

  useEffect(() => {
    if (user) {
      fetchSecurityEvents();
      fetchSecurityStats();
      
      // Log admin access to security dashboard
      enhancedSecurity.logAdminAccess(user.id, 'view_security_dashboard');
    }
  }, [user]);

  const fetchSecurityEvents = async () => {
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

  const fetchSecurityStats = async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const { data: allEvents, error } = await supabase
        .from('security_events')
        .select('event_type')
        .gte('created_at', twentyFourHoursAgo.toISOString());

      if (error) throw error;

      const eventCounts = allEvents?.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      setStats({
        totalEvents: allEvents?.length || 0,
        criticalEvents: (eventCounts['login_failed'] || 0) + (eventCounts['admin_access'] || 0),
        loginAttempts: (eventCounts['login_success'] || 0) + (eventCounts['login_failed'] || 0),
        adminAccess: eventCounts['admin_access'] || 0
      });
    } catch (error) {
      console.error('Error fetching security stats:', error);
    }
  };

  const getEventSeverity = (eventType: string) => {
    const highSeverity = ['login_failed', 'admin_access', 'webhook_verification_failed'];
    const mediumSeverity = ['api_request', 'session_activity'];
    
    if (highSeverity.includes(eventType)) return 'high';
    if (mediumSeverity.includes(eventType)) return 'medium';
    return 'low';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'outline';
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'login_failed':
      case 'login_success':
        return <Lock className="h-4 w-4" />;
      case 'admin_access':
        return <Shield className="h-4 w-4" />;
      case 'api_request':
        return <Activity className="h-4 w-4" />;
      case 'session_activity':
        return <Eye className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getEventDescription = (event: SecurityEvent) => {
    const descriptions: Record<string, string> = {
      'login_failed': 'ログイン失敗',
      'login_success': 'ログイン成功',
      'admin_access': '管理者アクセス',
      'api_request': 'APIリクエスト',
      'session_activity': 'セッション活動',
      'webhook_verification_failed': 'Webhook検証失敗'
    };
    return descriptions[event.event_type] || event.event_type;
  };

  const formatEventTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>セキュリティダッシュボード</CardTitle>
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            セキュリティダッシュボード
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalEvents}
              </div>
              <div className="text-sm text-blue-600">総イベント数（24h）</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {stats.criticalEvents}
              </div>
              <div className="text-sm text-red-600">重要イベント（24h）</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {stats.loginAttempts}
              </div>
              <div className="text-sm text-green-600">ログイン試行（24h）</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.adminAccess}
              </div>
              <div className="text-sm text-purple-600">管理者アクセス（24h）</div>
            </div>
          </div>

          {stats.criticalEvents > 10 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>注意:</strong> 過去24時間で{stats.criticalEvents}件の重要なセキュリティイベントが発生しています。
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 mb-4">
            <Button onClick={fetchSecurityEvents} variant="outline" size="sm">
              <Clock className="h-4 w-4 mr-2" />
              更新
            </Button>
          </div>
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
                    {getEventIcon(event.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {getEventDescription(event)}
                      </span>
                      <Badge variant={getSeverityColor(getEventSeverity(event.event_type))}>
                        {getEventSeverity(event.event_type).toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatEventTime(event.created_at)}</span>
                      {event.ip_address && (
                        <span>IP: {event.ip_address}</span>
                      )}
                      {event.details?.email && (
                        <span>Email: {event.details.email}</span>
                      )}
                      {event.details?.action && (
                        <span>Action: {event.details.action}</span>
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
