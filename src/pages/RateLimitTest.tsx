import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { RateLimitNotification } from "@/components/RateLimitNotification";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RateLimitTest = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [loading, setLoading] = useState(false);

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
          <div className="space-y-4">
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

            <div className="flex gap-2">
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
