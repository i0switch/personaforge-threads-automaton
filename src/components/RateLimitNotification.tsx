import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Clock, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface RateLimitedPersona {
  id: string;
  name: string;
  rate_limit_detected_at: string;
  rate_limit_reason: string;
  rate_limit_until: string | null;
}

export const RateLimitNotification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rateLimitedPersonas, setRateLimitedPersonas] = useState<RateLimitedPersona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchRateLimitedPersonas = async () => {
      try {
        const { data, error } = await supabase
          .from('personas')
          .select('id, name, rate_limit_detected_at, rate_limit_reason, rate_limit_until')
          .eq('user_id', user.id)
          .eq('is_rate_limited', true)
          .eq('is_active', true);

        if (error) throw error;

        // 期限切れのレート制限を自動解除
        const now = new Date();
        const validPersonas: RateLimitedPersona[] = [];

        for (const persona of data || []) {
          if (persona.rate_limit_until) {
            const limitUntil = new Date(persona.rate_limit_until);
            if (now >= limitUntil) {
              // レート制限を解除
              await supabase
                .from('personas')
                .update({
                  is_rate_limited: false,
                  rate_limit_detected_at: null,
                  rate_limit_reason: null,
                  rate_limit_until: null
                })
                .eq('id', persona.id);
              console.log(`✅ レート制限自動解除: ${persona.name}`);
            } else {
              validPersonas.push(persona);
            }
          } else {
            validPersonas.push(persona);
          }
        }

        setRateLimitedPersonas(validPersonas);
      } catch (error) {
        console.error('Error fetching rate limited personas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRateLimitedPersonas();

    // リアルタイム更新: personasテーブルの変更を監視
    const channel = supabase
      .channel('rate-limit-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'personas',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchRateLimitedPersonas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading || rateLimitedPersonas.length === 0) {
    return null;
  }

  const getTimeRemaining = (until: string | null) => {
    if (!until) return "不明";
    
    const now = new Date().getTime();
    const untilTime = new Date(until).getTime();
    const diff = untilTime - now;
    
    if (diff <= 0) return "まもなく解除予定";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `約${hours}時間${minutes}分後`;
    }
    return `約${minutes}分後`;
  };

  return (
    <div className="space-y-4">
      {rateLimitedPersonas.map((persona) => (
        <Alert key={persona.id} className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-orange-800 font-bold flex items-center gap-2">
            <span>⚠️ レート制限中: {persona.name}</span>
          </AlertTitle>
          <AlertDescription className="text-orange-700 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">理由:</p>
                <p className="text-sm">{persona.rate_limit_reason}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>検出時刻 (JST): {new Date(persona.rate_limit_detected_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
            </div>
            
            <div className="bg-orange-100 p-3 rounded-md">
              <p className="font-semibold text-orange-900 mb-1">📍 制限解除予定:</p>
              <p className="text-orange-800">{getTimeRemaining(persona.rate_limit_until)}</p>
            </div>
            
            <div className="bg-white/50 p-3 rounded-md border border-orange-200">
              <p className="font-semibold text-orange-900 mb-2">💡 対策:</p>
              <ul className="text-sm space-y-1 list-disc list-inside text-orange-800">
                <li>投稿・返信の頻度を下げる</li>
                <li>異なる内容のコンテンツを投稿する</li>
                <li>時間をおいて再試行する</li>
                <li>制限が自動解除されるまで待つ</li>
              </ul>
            </div>
            
            <Button
              onClick={() => navigate('/persona-setup')}
              variant="outline"
              size="sm"
              className="border-orange-400 text-orange-700 hover:bg-orange-100"
            >
              ペルソナ設定を確認
            </Button>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};
