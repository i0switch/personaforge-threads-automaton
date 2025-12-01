import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PostingMetric {
  persona_id: string;
  persona_name: string;
  date: string;
  attempts: number;
  successes: number;
  failures: number;
  token_errors: number;
  rate_limit_errors: number;
  api_errors: number;
  network_errors: number;
  success_rate: number;
}

export const PostingMetricsDashboard = () => {
  const [metrics, setMetrics] = useState<PostingMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    
    // リアルタイム更新を監視
    const channel = supabase
      .channel('posting-metrics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posting_metrics'
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 過去7日間のメトリクスを取得
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('posting_metrics')
        .select(`
          *,
          personas!inner(name)
        `)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        console.error('メトリクス取得エラー:', error);
        return;
      }

      const formattedMetrics = data?.map(m => ({
        persona_id: m.persona_id,
        persona_name: (m.personas as any).name,
        date: m.date,
        attempts: m.attempts,
        successes: m.successes,
        failures: m.failures,
        token_errors: m.token_errors,
        rate_limit_errors: m.rate_limit_errors,
        api_errors: m.api_errors,
        network_errors: m.network_errors,
        success_rate: m.success_rate
      })) || [];

      setMetrics(formattedMetrics);
    } catch (error) {
      console.error('メトリクス取得中にエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            投稿成功率メトリクス
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return null;
  }

  // ペルソナごとに集計
  const personaMetrics = metrics.reduce((acc, m) => {
    if (!acc[m.persona_id]) {
      acc[m.persona_id] = {
        persona_name: m.persona_name,
        total_attempts: 0,
        total_successes: 0,
        total_failures: 0,
        token_errors: 0,
        rate_limit_errors: 0,
        api_errors: 0,
        network_errors: 0,
      };
    }
    acc[m.persona_id].total_attempts += m.attempts;
    acc[m.persona_id].total_successes += m.successes;
    acc[m.persona_id].total_failures += m.failures;
    acc[m.persona_id].token_errors += m.token_errors;
    acc[m.persona_id].rate_limit_errors += m.rate_limit_errors;
    acc[m.persona_id].api_errors += m.api_errors;
    acc[m.persona_id].network_errors += m.network_errors;
    return acc;
  }, {} as Record<string, any>);

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <TrendingUp className="h-5 w-5" />
          投稿成功率メトリクス（過去7日間）
        </CardTitle>
        <CardDescription className="text-blue-700">
          ペルソナごとの投稿成功率とエラー統計
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(personaMetrics).map(([personaId, data]) => {
          const successRate = data.total_attempts > 0
            ? (data.total_successes / data.total_attempts) * 100
            : 0;

          return (
            <div key={personaId} className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{data.persona_name}</h4>
                <Badge 
                  variant={successRate >= 90 ? "default" : successRate >= 70 ? "secondary" : "destructive"}
                  className="text-sm"
                >
                  {successRate.toFixed(1)}% 成功
                </Badge>
              </div>

              <Progress value={successRate} className="mb-3" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-gray-600">試行回数</p>
                    <p className="font-semibold">{data.total_attempts}件</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-gray-600">成功</p>
                    <p className="font-semibold text-green-700">{data.total_successes}件</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-gray-600">失敗</p>
                    <p className="font-semibold text-red-700">{data.total_failures}件</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-gray-600">エラー内訳</p>
                    <p className="text-xs text-gray-600">
                      トークン: {data.token_errors} / 
                      制限: {data.rate_limit_errors}
                    </p>
                  </div>
                </div>
              </div>

              {/* エラーの詳細 */}
              {(data.token_errors > 0 || data.rate_limit_errors > 0 || data.api_errors > 0 || data.network_errors > 0) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">エラー詳細:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {data.token_errors > 0 && (
                      <Badge variant="outline" className="border-red-300 text-red-700">
                        トークン期限切れ: {data.token_errors}
                      </Badge>
                    )}
                    {data.rate_limit_errors > 0 && (
                      <Badge variant="outline" className="border-orange-300 text-orange-700">
                        レート制限: {data.rate_limit_errors}
                      </Badge>
                    )}
                    {data.api_errors > 0 && (
                      <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                        APIエラー: {data.api_errors}
                      </Badge>
                    )}
                    {data.network_errors > 0 && (
                      <Badge variant="outline" className="border-gray-300 text-gray-700">
                        通信エラー: {data.network_errors}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};