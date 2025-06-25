
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, CheckCircle, Scan, Activity, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { securityAudit, SecurityScanResult } from "@/utils/securityAudit";

export const SecurityDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [securityIssues, setSecurityIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSecurityData();
    }
  }, [user]);

  const loadSecurityData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const [scanData, issues] = await Promise.all([
        securityAudit.performSecurityScan(user.id),
        securityAudit.validateSecuritySettings(user.id)
      ]);
      
      setScanResult(scanData);
      setSecurityIssues(issues);
    } catch (error) {
      console.error('Failed to load security data:', error);
      toast({
        title: "エラー",
        description: "セキュリティデータの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runSecurityScan = async () => {
    if (!user) return;
    
    setScanning(true);
    try {
      const result = await securityAudit.performSecurityScan(user.id);
      setScanResult(result);
      
      toast({
        title: "スキャン完了",
        description: "セキュリティスキャンが完了しました",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "セキュリティスキャンに失敗しました",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const getSecurityScore = () => {
    if (!scanResult) return 0;
    const { high, medium, low } = scanResult.vulnerabilities;
    const totalVulns = high * 3 + medium * 2 + low * 1;
    const maxScore = 100;
    return Math.max(0, maxScore - totalVulns * 10);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const securityScore = getSecurityScore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            セキュリティダッシュボード
          </h2>
          <p className="text-muted-foreground">
            システムのセキュリティ状態を監視・管理
          </p>
        </div>
        <Button onClick={runSecurityScan} disabled={scanning}>
          <Scan className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'スキャン中...' : 'スキャン実行'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">セキュリティスコア</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(securityScore)}`}>
              {securityScore}/100
            </div>
            <Progress value={securityScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {scanResult ? `最終スキャン: ${new Date(scanResult.lastScan).toLocaleDateString('ja-JP')}` : 'スキャン未実行'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">脆弱性</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">重要</span>
                <Badge variant="destructive">
                  {scanResult?.vulnerabilities.high || 0}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">中程度</span>
                <Badge variant="secondary">
                  {scanResult?.vulnerabilities.medium || 0}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">軽微</span>
                <Badge variant="outline">
                  {scanResult?.vulnerabilities.low || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ステータス</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {securityIssues.length === 0 ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-600">良好</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-yellow-600">注意</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {securityIssues.length}件の問題が検出されました
            </p>
          </CardContent>
        </Card>
      </div>

      {securityIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              セキュリティ問題
            </CardTitle>
            <CardDescription>
              以下の問題を確認してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {securityIssues.map((issue, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{issue}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {scanResult && scanResult.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              セキュリティ推奨事項
            </CardTitle>
            <CardDescription>
              セキュリティを向上させるための推奨事項
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scanResult.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
