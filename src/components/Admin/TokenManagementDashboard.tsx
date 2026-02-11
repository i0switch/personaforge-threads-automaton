import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface TokenInfo {
  id: string;
  name: string;
  threads_username: string | null;
  threads_user_id: string | null;
  has_token: boolean;
  token_expires_at: string | null;
  token_refreshed_at: string | null;
  is_active: boolean;
  user_email?: string;
}

export const TokenManagementDashboard = () => {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<any>(null);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('personas')
        .select('id, name, threads_username, threads_user_id, threads_access_token, token_expires_at, token_refreshed_at, is_active, user_id')
        .order('name');

      if (error) throw error;

      const tokenInfos: TokenInfo[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        threads_username: p.threads_username,
        threads_user_id: p.threads_user_id,
        has_token: !!p.threads_access_token && p.threads_access_token.length > 10,
        token_expires_at: p.token_expires_at,
        token_refreshed_at: p.token_refreshed_at,
        is_active: p.is_active,
      }));

      setTokens(tokenInfos);
    } catch (err) {
      console.error('Error fetching tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    try {
      setRefreshing(true);
      setRefreshResult(null);
      const { data, error } = await supabase.functions.invoke('refresh-threads-tokens');
      if (error) throw error;
      setRefreshResult(data);
      toast({
        title: 'トークン更新完了',
        description: `成功: ${data?.summary?.success || 0}, 失敗: ${data?.summary?.failed || 0}`,
      });
      await fetchTokens();
    } catch (err) {
      console.error('Refresh error:', err);
      toast({ title: 'エラー', description: 'トークン更新に失敗しました', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  const getTokenStatus = (token: TokenInfo) => {
    if (!token.has_token) {
      return { label: '未設定', icon: XCircle, variant: 'destructive' as const, color: 'text-destructive' };
    }
    if (!token.token_expires_at) {
      return { label: '期限不明', icon: Clock, variant: 'secondary' as const, color: 'text-muted-foreground' };
    }
    const expiresAt = new Date(token.token_expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      return { label: '期限切れ', icon: XCircle, variant: 'destructive' as const, color: 'text-destructive' };
    }
    if (daysLeft <= 7) {
      return { label: `残り${daysLeft}日`, icon: AlertTriangle, variant: 'secondary' as const, color: 'text-orange-500' };
    }
    return { label: `残り${daysLeft}日`, icon: CheckCircle, variant: 'default' as const, color: 'text-green-500' };
  };

  const stats = {
    total: tokens.length,
    active: tokens.filter(t => t.is_active).length,
    hasToken: tokens.filter(t => t.has_token).length,
    expired: tokens.filter(t => {
      if (!t.token_expires_at) return false;
      return new Date(t.token_expires_at) < new Date();
    }).length,
    expiringSoon: tokens.filter(t => {
      if (!t.token_expires_at) return false;
      const days = (new Date(t.token_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 7;
    }).length,
    noUserId: tokens.filter(t => t.has_token && !t.threads_user_id).length,
  };

  if (loading) return <div>読み込み中...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: '総数', value: stats.total, color: '' },
          { label: 'アクティブ', value: stats.active, color: 'text-green-600' },
          { label: 'トークン有', value: stats.hasToken, color: 'text-blue-600' },
          { label: '期限切れ', value: stats.expired, color: 'text-destructive' },
          { label: '期限間近', value: stats.expiringSoon, color: 'text-orange-500' },
          { label: 'UserID未設定', value: stats.noUserId, color: 'text-yellow-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleRefreshAll} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          期限間近のトークンを一括更新
        </Button>
        <Button variant="outline" onClick={fetchTokens}>
          <RefreshCw className="h-4 w-4 mr-2" />
          再読み込み
        </Button>
      </div>

      {/* Refresh Result */}
      {refreshResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">更新結果</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              成功: {refreshResult.summary?.success || 0} / 失敗: {refreshResult.summary?.failed || 0}
            </p>
            {refreshResult.results?.filter((r: any) => !r.success).length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-destructive">失敗一覧:</p>
                {refreshResult.results.filter((r: any) => !r.success).map((r: any) => (
                  <p key={r.id} className="text-xs text-muted-foreground">
                    {r.name}: {r.error}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Token List */}
      <Card>
        <CardHeader>
          <CardTitle>ペルソナ別トークン状態</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">ペルソナ</th>
                  <th className="text-left py-2 px-2">ユーザー名</th>
                  <th className="text-left py-2 px-2">UserID</th>
                  <th className="text-left py-2 px-2">トークン状態</th>
                  <th className="text-left py-2 px-2">最終更新</th>
                  <th className="text-left py-2 px-2">状態</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => {
                  const status = getTokenStatus(token);
                  const StatusIcon = status.icon;
                  return (
                    <tr key={token.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{token.name}</td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {token.threads_username ? `@${token.threads_username}` : '-'}
                      </td>
                      <td className="py-2 px-2">
                        {token.threads_user_id ? (
                          <span className="text-xs font-mono">{token.threads_user_id}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs">未設定</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <StatusIcon className={`h-4 w-4 ${status.color}`} />
                          <span className={status.color}>{status.label}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">
                        {token.token_refreshed_at
                          ? new Date(token.token_refreshed_at).toLocaleDateString('ja-JP')
                          : '-'}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant={token.is_active ? 'default' : 'secondary'}>
                          {token.is_active ? '有効' : '無効'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
