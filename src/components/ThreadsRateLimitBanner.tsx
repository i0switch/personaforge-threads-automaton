import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface RateLimitEvent {
  id: string;
  persona_name: string;
  created_at: string;
}

/**
 * Threads API error 613（返信レート制限）の発生履歴をバナーで表示する
 * 自動返信ページなど関連ページに配置して使用する
 */
export const ThreadsRateLimitBanner = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<RateLimitEvent[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchRecentEvents = async () => {
    if (!user) return;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("activity_logs")
      .select("id, metadata, created_at")
      .eq("user_id", user.id)
      .eq("action_type", "threads_reply_rate_limited")
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(3);

    if (data) {
      const unique = new Map<string, RateLimitEvent>();
      for (const row of data) {
        const meta = row.metadata as any;
        const name = meta?.persona_name || "不明";
        if (!unique.has(name)) {
          unique.set(name, {
            id: row.id,
            persona_name: name,
            created_at: row.created_at,
          });
        }
      }
      setEvents(Array.from(unique.values()));
    }
  };

  useEffect(() => {
    fetchRecentEvents();

    const channel = supabase
      .channel("rate-limit-banner")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (record.action_type === "threads_reply_rate_limited") {
            fetchRecentEvents();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const visibleEvents = events.filter((e) => !dismissed.has(e.id));
  if (visibleEvents.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visibleEvents.map((event) => (
        <Alert key={event.id} variant="destructive" className="relative pr-10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-bold">
            Threads 返信レート制限 (error 613)
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-1 text-sm">
            <p>
              ペルソナ「<strong>{event.persona_name}</strong>
              」が直近1時間以内にThreads APIの返信レート制限に達しました。
            </p>
            <p className="text-xs opacity-80">
              検出時刻:{" "}
              {new Date(event.created_at).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
              })}
            </p>
            <div className="mt-2 p-2 bg-white/10 rounded text-xs space-y-1">
              <p className="font-semibold">💡 対処法：</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>自動返信の遅延時間（delay_minutes）を 1〜2分以上に設定する</li>
                <li>キーワードの数を絞り、返信頻度を下げる</li>
                <li>しばらく待つと自動的に制限が解除される</li>
              </ul>
            </div>
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-destructive-foreground hover:bg-white/10"
            onClick={() => setDismissed((prev) => new Set([...prev, event.id]))}
          >
            <X className="h-3 w-3" />
          </Button>
        </Alert>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={fetchRecentEvents}
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        最新状態に更新
      </Button>
    </div>
  );
};
