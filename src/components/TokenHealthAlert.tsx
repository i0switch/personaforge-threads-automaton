import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TokenHealth {
  personaId: string;
  personaName: string;
  isHealthy: boolean;
  lastChecked: string;
  error?: string;
}

export const TokenHealthAlert = () => {
  const [unhealthyTokens, setUnhealthyTokens] = useState<TokenHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkTokenHealth();
    
    // 5分ごとに自動チェック
    const interval = setInterval(checkTokenHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkTokenHealth = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('check-token-health', {
        body: {}
      });

      if (error) {
        console.error('トークンヘルスチェックエラー:', error);
        return;
      }

      if (data?.success && data?.data) {
        const unhealthy = data.data.filter((t: TokenHealth) => !t.isHealthy);
        setUnhealthyTokens(unhealthy);
      }
    } catch (error) {
      console.error('トークンヘルスチェック中にエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (personaId: string) => {
    toast({
      title: "トークン更新",
      description: "ペルソナ設定画面でトークンを再設定してください",
    });
    navigate(`/persona-setup`);
  };

  if (!visible || unhealthyTokens.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {unhealthyTokens.map((token) => (
        <Alert key={token.personaId} variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-red-800 font-semibold">
            トークン期限切れ: {token.personaName}
          </AlertTitle>
          <AlertDescription className="text-red-700">
            <div className="space-y-2">
              <p>
                {token.error || 'Threadsアクセストークンが無効または期限切れです。'}
              </p>
              <p className="text-sm">
                最終チェック: {new Date(token.lastChecked).toLocaleString('ja-JP')}
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => handleRefresh(token.personaId)}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  トークンを更新
                </Button>
                <Button
                  onClick={() => setVisible(false)}
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  閉じる
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};