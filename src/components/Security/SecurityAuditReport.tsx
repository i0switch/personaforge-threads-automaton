
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, FileText, TrendingUp, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { securityAudit, SecurityScanResult } from "@/utils/securityAudit";
import { ZapScanResults } from "./ZapScanResults";

interface AuditSummary {
  totalIssues: number;
  resolvedIssues: number;
  securityScore: number;
  lastAuditDate: string;
  trends: {
    weeklyChange: number;
    monthlyChange: number;
  };
}

export const SecurityAuditReport = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user) {
      loadAuditData();
    }
  }, [user]);

  const loadAuditData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // セキュリティスキャン実行
      const result = await securityAudit.performSecurityScan(user.id);
      setScanResult(result);

      // 監査サマリー作成
      const totalVulns = result.vulnerabilities.high + result.vulnerabilities.medium + result.vulnerabilities.low;
      const securityScore = Math.max(0, 100 - (totalVulns * 10));
      
      const summary: AuditSummary = {
        totalIssues: totalVulns,
        resolvedIssues: 0, // 実際の実装では解決済み問題数を計算
        securityScore,
        lastAuditDate: new Date().toISOString(),
        trends: {
          weeklyChange: -5, // 実際の実装では週間変化を計算
          monthlyChange: -12 // 実際の実装では月間変化を計算
        }
      };

      setAuditSummary(summary);
    } catch (error) {
      console.error('Failed to load audit data:', error);
      toast({
        title: "エラー",
        description: "監査データの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateFullReport = async () => {
    if (!user || !auditSummary || !scanResult) return;

    setGenerating(true);
    try {
      // レポート生成
      const reportData = {
        summary: auditSummary,
        vulnerabilities: scanResult.vulnerabilities,
        recommendations: scanResult.recommendations,
        generatedAt: new Date().toISOString(),
        userId: user.id
      };

      // JSONレポートとしてダウンロード
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `security_audit_report_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "レポート生成完了",
        description: "セキュリティ監査レポートをダウンロードしました",
      });
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast({
        title: "エラー",
        description: "レポート生成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (change < 0) return <TrendingUp className="h-4 w-4 text-green-500 rotate-180" />;
    return <div className="h-4 w-4" />;
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
            <Shield className="h-6 w-6" />
            セキュリティ監査レポート
          </h2>
          <p className="text-muted-foreground">
            システムの包括的なセキュリティ分析結果
          </p>
        </div>
        <Button onClick={generateFullReport} disabled={generating}>
          <Download className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'レポート生成中...' : 'レポート生成'}
        </Button>
      </div>

      {auditSummary && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">セキュリティスコア</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(auditSummary.securityScore)}`}>
                {auditSummary.securityScore}/100
              </div>
              <Progress value={auditSummary.securityScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">検出問題</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{auditSummary.totalIssues}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon(auditSummary.trends.weeklyChange)}
                <span className="ml-1">週間変化: {auditSummary.trends.weeklyChange}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">解決済み</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{auditSummary.resolvedIssues}</div>
              <div className="text-xs text-muted-foreground">
                解決率: {auditSummary.totalIssues > 0 ? 
                  Math.round((auditSummary.resolvedIssues / auditSummary.totalIssues) * 100) : 100}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">最終監査</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {new Date(auditSummary.lastAuditDate).toLocaleDateString('ja-JP')}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(auditSummary.lastAuditDate).toLocaleTimeString('ja-JP')}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="vulnerabilities">脆弱性</TabsTrigger>
          <TabsTrigger value="recommendations">推奨事項</TabsTrigger>
          <TabsTrigger value="zap-scan">ZAPスキャン</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>監査概要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {scanResult && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {scanResult.vulnerabilities.high}
                      </div>
                      <div className="text-sm text-muted-foreground">重要な脆弱性</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {scanResult.vulnerabilities.medium}
                      </div>
                      <div className="text-sm text-muted-foreground">中程度の脆弱性</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {scanResult.vulnerabilities.low}
                      </div>
                      <div className="text-sm text-muted-foreground">軽微な脆弱性</div>
                    </div>
                  </div>

                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      最新のセキュリティスキャンが完了しました。
                      詳細な結果は各タブで確認できます。
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vulnerabilities">
          <Card>
            <CardHeader>
              <CardTitle>検出された脆弱性</CardTitle>
            </CardHeader>
            <CardContent>
              {scanResult ? (
                <div className="space-y-4">
                  {scanResult.vulnerabilities.high > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{scanResult.vulnerabilities.high}件の重要な脆弱性</strong>が検出されています。
                        直ちに対応が必要です。
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {scanResult.vulnerabilities.medium > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{scanResult.vulnerabilities.medium}件の中程度の脆弱性</strong>が検出されています。
                        計画的な対応を推奨します。
                      </AlertDescriptio>
                    </Alert>
                  )}

                  {scanResult.vulnerabilities.low > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{scanResult.vulnerabilities.low}件の軽微な脆弱性</strong>が検出されています。
                        時間があるときに対応してください。
                      </AlertDescription>
                    </Alert>
                  )}

                  {scanResult.vulnerabilities.high === 0 && 
                   scanResult.vulnerabilities.medium === 0 && 
                   scanResult.vulnerabilities.low === 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        現在、検出されている脆弱性はありません。
                        セキュリティ状態は良好です。
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">スキャン結果がありません</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>セキュリティ推奨事項</CardTitle>
            </CardHeader>
            <CardContent>
              {scanResult && scanResult.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {scanResult.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{recommendation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">推奨事項はありません</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zap-scan">
          <ZapScanResults />
        </TabsContent>
      </Tabs>
    </div>
  );
};
