import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, Info, CheckCircle, Clock, Eye } from "lucide-react";
import { zapScanResults, getZapScanSummary, getRiskColor, getStatusColor, ZapAlert } from "@/utils/zapScanResults";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export const ZapScanResults = () => {
  const [selectedAlert, setSelectedAlert] = useState<ZapAlert | null>(null);
  const summary = getZapScanSummary();

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'low': return <Info className="h-4 w-4 text-blue-600" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'investigating': return <Clock className="h-4 w-4 text-orange-600" />;
      case 'acknowledged': return <Eye className="h-4 w-4 text-blue-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            ZAPスキャン結果サマリー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.high}</div>
              <div className="text-sm text-red-600">高リスク</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
              <div className="text-sm text-yellow-600">中リスク</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary.low}</div>
              <div className="text-sm text-blue-600">低リスク</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{summary.info}</div>
              <div className="text-sm text-gray-600">情報</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">{summary.resolved}</div>
              <div className="text-sm text-green-600">解決済み</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-xl font-bold text-orange-600">{summary.investigating}</div>
              <div className="text-sm text-orange-600">調査中</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{summary.acknowledged}</div>
              <div className="text-sm text-blue-600">確認済み</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-xl font-bold text-red-600">{summary.pending}</div>
              <div className="text-sm text-red-600">保留中</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>検出されたアラート</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>リスクレベル</TableHead>
                <TableHead>アラート名</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>信頼度</TableHead>
                <TableHead>詳細</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zapScanResults.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <Badge className={`${getRiskColor(alert.riskLevel)} flex items-center gap-1`}>
                      {getRiskIcon(alert.riskLevel)}
                      {alert.riskLevel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{alert.name}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(alert.status)} flex items-center gap-1`}>
                      {getStatusIcon(alert.status)}
                      {alert.status === 'resolved' ? '解決済み' :
                       alert.status === 'investigating' ? '調査中' :
                       alert.status === 'acknowledged' ? '確認済み' : '保留中'}
                    </Badge>
                  </TableCell>
                  <TableCell>{alert.confidence}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          詳細を見る
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {getRiskIcon(alert.riskLevel)}
                            {alert.name}
                          </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-96">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">詳細説明</h4>
                              <p className="text-sm text-muted-foreground">{alert.description}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">推奨対策</h4>
                              <p className="text-sm text-muted-foreground">{alert.solution}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">影響を受けるURL</h4>
                              <ul className="text-sm text-muted-foreground">
                                {alert.affected_urls.map((url, index) => (
                                  <li key={index} className="break-all">{url}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span><strong>検出日時:</strong> {new Date(alert.detected_at).toLocaleString('ja-JP')}</span>
                              <Badge className={getRiskColor(alert.riskLevel)}>
                                {alert.riskLevel}リスク
                              </Badge>
                              <Badge className={getStatusColor(alert.status)}>
                                {alert.status === 'resolved' ? '解決済み' :
                                 alert.status === 'investigating' ? '調査中' :
                                 alert.status === 'acknowledged' ? '確認済み' : '保留中'}
                              </Badge>
                            </div>
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>注意:</strong> 一部のセキュリティヘッダーはHTMLのmetaタグで対応済みですが、
          サーバーレベルでの設定が必要な項目（HSTS、CORS等）については、ホスティングプロバイダー側での設定が必要です。
          Lovableのホスティング環境では一部制限があります。
        </AlertDescription>
      </Alert>
    </div>
  );
};