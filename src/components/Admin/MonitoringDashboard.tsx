import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, RefreshCw, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MonitoringData {
  activePersonas: number;
  autoPostConfigs: number;
  randomPostConfigs: number;
  duplicateConfigs: number;
  pastSchedules: number;
  recentPosts: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface ConfigIssue {
  type: 'duplicate' | 'past_schedule' | 'no_config';
  persona_name: string;
  persona_id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export const MonitoringDashboard = () => {
  const [data, setData] = useState<MonitoringData>({
    activePersonas: 0,
    autoPostConfigs: 0,
    randomPostConfigs: 0,
    duplicateConfigs: 0,
    pastSchedules: 0,
    recentPosts: 0,
    systemHealth: 'healthy'
  });
  const [issues, setIssues] = useState<ConfigIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadMonitoringData = async () => {
    console.log('監視ダッシュボード: データ取得開始');
    try {
      // アクティブなペルソナとその設定を取得
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select(`
          id, name, is_active,
          auto_post_configs!auto_post_configs_persona_id_fkey(id, is_active, next_run_at, created_at),
          random_post_configs!random_post_configs_persona_id_fkey(id, is_active, next_run_at, created_at)
        `)
        .eq('is_active', true);

      console.log('ペルソナデータ取得結果:', { personasData, personasError });

      if (personasError) throw personasError;

      // 問題を分析
      const detectedIssues: ConfigIssue[] = [];
      let totalAutoConfigs = 0;
      let totalRandomConfigs = 0;
      
      personasData?.forEach(persona => {
        const activeAutoConfigs = persona.auto_post_configs?.filter(c => c.is_active) || [];
        const activeRandomConfigs = persona.random_post_configs?.filter(c => c.is_active) || [];
        
        totalAutoConfigs += activeAutoConfigs.length;
        totalRandomConfigs += activeRandomConfigs.length;
        
        // 重複設定チェック
        if (activeAutoConfigs.length > 1) {
          detectedIssues.push({
            type: 'duplicate',
            persona_name: persona.name,
            persona_id: persona.id,
            description: `${activeAutoConfigs.length}個の重複したオートポスト設定`,
            severity: 'high'
          });
        }
        
        // 過去スケジュールチェック
        const pastSchedules = [...activeAutoConfigs, ...activeRandomConfigs]
          .filter(c => c.next_run_at && new Date(c.next_run_at) < new Date());
          
        if (pastSchedules.length > 0) {
          detectedIssues.push({
            type: 'past_schedule',
            persona_name: persona.name,
            persona_id: persona.id,
            description: `${pastSchedules.length}個の過去の実行予定`,
            severity: 'medium'
          });
        }
      });

      setData({
        activePersonas: personasData?.length || 0,
        autoPostConfigs: totalAutoConfigs,
        randomPostConfigs: totalRandomConfigs,
        duplicateConfigs: detectedIssues.filter(i => i.type === 'duplicate').length,
        pastSchedules: detectedIssues.filter(i => i.type === 'past_schedule').length,
        recentPosts: 0, // TODO: 過去24時間の投稿数
        systemHealth: detectedIssues.some(i => i.severity === 'high') ? 'critical' : 
                     detectedIssues.some(i => i.severity === 'medium') ? 'warning' : 'healthy'
      });
      
      setIssues(detectedIssues);
    } catch (error) {
      console.error('監視データ取得エラー:', error);
      console.error('エラーの詳細:', JSON.stringify(error, null, 2));
      toast({
        title: "監視データの取得に失敗しました",
        description: `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitoringData();
    // 30秒ごとに自動更新
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'critical': return AlertTriangle;
      default: return Activity;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const HealthIcon = getHealthIcon(data.systemHealth);

  return (
    <div className="space-y-6">
      {/* システムヘルス */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HealthIcon className={`h-5 w-5 ${getHealthColor(data.systemHealth)}`} />
            システム状態
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadMonitoringData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            更新
          </Button>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getHealthColor(data.systemHealth)}`}>
            {data.systemHealth === 'healthy' ? '正常' : 
             data.systemHealth === 'warning' ? '注意' : '異常'}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {issues.length === 0 ? '問題は検出されていません' : `${issues.length}件の問題を検出`}
          </p>
        </CardContent>
      </Card>

      {/* 統計情報 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">アクティブペルソナ</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activePersonas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">オートポスト設定</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.autoPostConfigs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ランダムポスト設定</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.randomPostConfigs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">検出された問題</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{issues.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* 問題一覧 */}
      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>検出された問題</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {issues.map((issue, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getSeverityColor(issue.severity) as any}>
                        {issue.severity === 'high' ? '重要' : 
                         issue.severity === 'medium' ? '注意' : '軽微'}
                      </Badge>
                      <span className="font-medium">{issue.persona_name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {issue.description}
                    </p>
                  </div>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};