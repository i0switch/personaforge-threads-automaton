import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

/**
 * Threads API error 613（返信レート制限）をリアルタイム監視して
 * トースト通知を表示するフック
 */
export const useThreadsRateLimitAlert = () => {
  const { user } = useAuth();
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // 起動時に直近5分以内の未通知エラーを確認
    const checkRecentErrors = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("activity_logs")
        .select("id, description, persona_id, created_at, metadata")
        .eq("user_id", user.id)
        .eq("action_type", "threads_reply_rate_limited")
        .gte("created_at", fiveMinutesAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        const latest = data[0];
        if (!notifiedIds.current.has(latest.id)) {
          notifiedIds.current.add(latest.id);
          const meta = latest.metadata as any;
          toast({
            title: "⚠️ Threads 返信レート制限",
            description: `ペルソナ「${meta?.persona_name || "不明"}」がThreads APIの返信レート制限(error 613)に達しました。返信の送信間隔を空けるか、しばらく待ってから再試行してください。`,
            variant: "destructive",
            duration: 10000,
          });
        }
      }
    };

    checkRecentErrors();

    // リアルタイム: activity_logsに新しいレート制限ログが来たら通知
    const channel = supabase
      .channel("threads-rate-limit-alert")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (
            record.action_type === "threads_reply_rate_limited" &&
            !notifiedIds.current.has(record.id)
          ) {
            notifiedIds.current.add(record.id);
            const meta = record.metadata as any;
            toast({
              title: "⚠️ Threads 返信レート制限",
              description: `ペルソナ「${meta?.persona_name || "不明"}」がThreads APIの返信レート制限(error 613)に達しました。返信の送信間隔を空けるか、しばらく待ってから再試行してください。`,
              variant: "destructive",
              duration: 10000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
};
