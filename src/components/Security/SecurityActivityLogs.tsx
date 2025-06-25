
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Search, Filter, Download, AlertTriangle, Shield, Lock } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface SecurityLog {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata: any;
}

export const SecurityActivityLogs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filteredLogs, setFilteredLogs] = useState<SecurityLog[]>([]);

  useEffect(() => {
    if (user) {
      loadSecurityLogs();
    }
  }, [user]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, filterType]);

  const loadSecurityLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user?.id)
        .like('action_type', 'security_%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Failed to load security logs:', error);
      toast({
        title: "エラー",
        description: "セキュリティログの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.action_type.includes(filterType));
    }

    setFilteredLogs(filtered);
  };

  const getLogIcon = (actionType: string) => {
    if (actionType.includes('alert')) return AlertTriangle;
    if (actionType.includes('auth')) return Lock;
    return Shield;
  };

  const getLogSeverity = (actionType: string) => {
    if (actionType.includes('critical') || actionType.includes('alert_authentication')) {
      return { color: 'destructive', label: '重要' };
    }
    if (actionType.includes('warning') || actionType.includes('alert')) {
      return { color: 'secondary', label: '警告' };
    }
    return { color: 'outline', label: '情報' };
  };

  const exportLogs = async () => {
    try {
      const csvContent = [
        ['日時', 'アクション', '説明', '詳細'].join(','),
        ...filteredLogs.map(log => [
          format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ja }),
          log.action_type,
          log.description,
          JSON.stringify(log.metadata || {})
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `security-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      toast({
        title: "成功",
        description: "セキュリティログをエクスポートしました",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "エクスポートに失敗しました",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            セキュリティアクティビティログ
          </h2>
          <p className="text-muted-foreground">
            セキュリティ関連の活動履歴を確認
          </p>
        </div>
        <Button onClick={exportLogs} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          エクスポート
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>フィルター</CardTitle>
          <CardDescription>
            ログを検索・フィルタリング
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="alert">アラート</SelectItem>
                <SelectItem value="auth">認証</SelectItem>
                <SelectItem value="injection">インジェクション</SelectItem>
                <SelectItem value="rate_limit">レート制限</SelectItem>
                <SelectItem value="file_upload">ファイルアップロード</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>アクティビティログ</CardTitle>
          <CardDescription>
            {filteredLogs.length}件のセキュリティイベント
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              セキュリティログが見つかりません
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>レベル</TableHead>
                    <TableHead>日時</TableHead>
                    <TableHead>アクション</TableHead>
                    <TableHead>説明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const Icon = getLogIcon(log.action_type);
                    const severity = getLogSeverity(log.action_type);
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant={severity.color as any}>
                            <Icon className="h-3 w-3 mr-1" />
                            {severity.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.created_at), 'MM/dd HH:mm:ss', { locale: ja })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.action_type}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.description}</div>
                            {log.metadata && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {JSON.stringify(log.metadata, null, 2).substring(0, 100)}
                                {JSON.stringify(log.metadata).length > 100 && '...'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
