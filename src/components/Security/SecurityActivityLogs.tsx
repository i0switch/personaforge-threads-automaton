
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, Filter, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ActivityLog {
  id: string;
  action_type: string;
  description?: string;
  user_id: string;
  persona_id?: string;
  metadata?: any;
  created_at: string;
}

export const SecurityActivityLogs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const logsPerPage = 20;

  useEffect(() => {
    if (user) {
      loadActivityLogs();
    }
  }, [user, page, filterType]);

  const loadActivityLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * logsPerPage, page * logsPerPage - 1);

      // フィルター適用
      if (filterType !== 'all') {
        query = query.like('action_type', `%${filterType}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotalPages(Math.ceil((count || 0) / logsPerPage));
    } catch (error) {
      console.error('Failed to load activity logs:', error);
      toast({
        title: "エラー",
        description: "活動ログの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      // 検索実装（実際のプロジェクトでは適切な検索ロジックを実装）
      const filtered = logs.filter(log => 
        log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setLogs(filtered);
    } else {
      loadActivityLogs();
    }
  };

  const exportLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const csvContent = [
        ['ID', 'Action Type', 'Description', 'User ID', 'Created At'].join(','),
        ...data.map(log => [
          log.id,
          log.action_type,
          log.description || '',
          log.user_id,
          log.created_at
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "エクスポート完了",
        description: "活動ログをCSVファイルとしてダウンロードしました",
      });
    } catch (error) {
      console.error('Failed to export logs:', error);
      toast({
        title: "エラー",
        description: "ログのエクスポートに失敗しました",
        variant: "destructive",
      });
    }
  };

  const getActionBadgeColor = (actionType: string) => {
    if (actionType.includes('error') || actionType.includes('failed')) return 'destructive';
    if (actionType.includes('security') || actionType.includes('admin')) return 'secondary';
    if (actionType.includes('login') || actionType.includes('success')) return 'default';
    return 'outline';
  };

  const formatActionType = (actionType: string) => {
    const translations: Record<string, string> = {
      'login_success': 'ログイン成功',
      'login_failed': 'ログイン失敗',
      'persona_created': 'ペルソナ作成',
      'persona_updated': 'ペルソナ更新',
      'post_created': '投稿作成',
      'auto_reply_sent': '自動返信送信',
      'security_setting_changed': 'セキュリティ設定変更',
      'admin_access_granted': '管理者アクセス許可'
    };
    return translations[actionType] || actionType;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            セキュリティ活動ログ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="flex gap-2">
                <Input
                  placeholder="ログを検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="フィルター" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="login">ログイン</SelectItem>
                  <SelectItem value="security">セキュリティ</SelectItem>
                  <SelectItem value="admin">管理者</SelectItem>
                  <SelectItem value="error">エラー</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-1" />
                エクスポート
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>アクション</TableHead>
                    <TableHead>説明</TableHead>
                    <TableHead>ユーザーID</TableHead>
                    <TableHead>日時</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant={getActionBadgeColor(log.action_type)}>
                          {formatActionType(log.action_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.description || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.user_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {new Date(log.created_at).toLocaleString('ja-JP')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    ページ {page} / {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      前へ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      次へ
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
