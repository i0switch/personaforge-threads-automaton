import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { RateLimitNotification } from "@/components/RateLimitNotification";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const RateLimitTest = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<any>(null);

  const loadPersonas = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('personas')
      .select('id, name, is_rate_limited')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました",
        variant: "destructive"
      });
      return;
    }

    setPersonas(data || []);
  };

  const setRateLimit = async () => {
    if (!selectedPersonaId) {
      toast({
        title: "エラー",
        description: "ペルソナを選択してください",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const rateLimitUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2時間後

      const { error } = await supabase
        .from('personas')
        .update({
          is_rate_limited: true,
          rate_limit_detected_at: new Date().toISOString(),
          rate_limit_reason: 'テスト: スパム検出により一時的に制限されています',
          rate_limit_until: rateLimitUntil.toISOString()
        })
        .eq('id', selectedPersonaId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "レート制限を設定しました",
      });

      await loadPersonas();
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const clearRateLimit = async () => {
    if (!selectedPersonaId) {
      toast({
        title: "エラー",
        description: "ペルソナを選択してください",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('personas')
        .update({
          is_rate_limited: false,
          rate_limit_detected_at: null,
          rate_limit_reason: null,
          rate_limit_until: null
        })
        .eq('id', selectedPersonaId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "レート制限を解除しました",
      });

      await loadPersonas();
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const detectRateLimitedPersonas = async () => {
    setDetecting(true);
    setDetectionResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('detect-rate-limited-personas', {
        body: {}
      });

      if (error) throw error;

      setDetectionResult(data);
      
      toast({
        title: "検出完了",
        description: `${data.detected_rate_limited}件のレート制限ペルソナを検出しました`,
      });

      await loadPersonas();
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>レート制限通知機能テスト</CardTitle>
          <CardDescription>
            ペルソナのレート制限状態をテストします
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>AI自動返信の問題について</AlertTitle>
            <AlertDescription>
              複数のペルソナでThreads APIのスパム検出により返信がブロックされています。
              「レート制限検出」ボタンで過去24時間の失敗リプライから自動検出します。
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Button 
                onClick={detectRateLimitedPersonas}
                disabled={detecting}
                className="w-full"
                size="lg"
              >
                {detecting ? "検出中..." : "🔍 レート制限ペルソナを検出"}
              </Button>
              {detectionResult && (
                <div className="mt-4 p-4 bg-muted rounded-md space-y-2">
                  <p className="font-semibold">検出結果:</p>
                  <ul className="text-sm space-y-1">
                    <li>• レート制限検出: {detectionResult.detected_rate_limited}件</li>
                    <li>• 更新されたペルソナ: {detectionResult.updated_personas?.length || 0}件</li>
                    <li>• 解除されたペルソナ: {detectionResult.cleared_personas?.length || 0}件</li>
                    <li>• 総失敗リプライ: {detectionResult.total_failed_replies}件</li>
                  </ul>
                  {detectionResult.updated_personas?.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold text-sm">更新されたペルソナ:</p>
                      <ul className="text-sm list-disc list-inside">
                        {detectionResult.updated_personas.map((p: any) => (
                          <li key={p.id}>{p.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">手動テスト</h3>
              <div>
                <label className="text-sm font-medium mb-2 block">ペルソナを選択</label>
                <div className="flex gap-2">
                  <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="ペルソナを選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {personas.map((persona) => (
                        <SelectItem key={persona.id} value={persona.id}>
                          {persona.name} {persona.is_rate_limited ? "🚫" : "✅"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={loadPersonas} variant="outline">
                    更新
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={setRateLimit} 
                  disabled={loading || !selectedPersonaId}
                  variant="destructive"
                >
                  レート制限を設定
                </Button>
                <Button 
                  onClick={clearRateLimit} 
                  disabled={loading || !selectedPersonaId}
                  variant="outline"
                >
                  レート制限を解除
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">通知プレビュー</h3>
            <RateLimitNotification />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RateLimitTest;
