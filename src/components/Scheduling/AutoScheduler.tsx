
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, Clock, RefreshCw, Info } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];

export const AutoScheduler = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [draftPosts, setDraftPosts] = useState<Post[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<Post[]>([]);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    loadPosts();
  }, [user]);

  const loadPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 下書き投稿（未スケジュール）を取得
      const { data: drafts, error: draftError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .is('scheduled_for', null);

      if (draftError) throw draftError;

      // 予約済み投稿を取得
      const { data: scheduled, error: scheduledError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'scheduled');

      if (scheduledError) throw scheduledError;

      setDraftPosts(drafts || []);
      setScheduledPosts(scheduled || []);
    } catch (error) {
      console.error('Error loading posts:', error);
      toast({
        title: "エラー",
        description: "投稿の読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const autoSchedulePosts = async () => {
    if (!user || draftPosts.length === 0) return;
    
    setScheduling(true);
    try {
      // スケジュール設定を取得
      const { data: settings, error: settingsError } = await supabase
        .from('scheduling_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      const optimalHours = settings?.optimal_hours || [9, 12, 15, 18, 21];
      const now = new Date();
      let scheduleTime = new Date();

      // 次の最適な時間を見つける
      const currentHour = now.getHours();
      const nextOptimalHour = optimalHours.find(hour => hour > currentHour) || optimalHours[0];
      
      if (nextOptimalHour <= currentHour) {
        scheduleTime.setDate(scheduleTime.getDate() + 1);
      }
      scheduleTime.setHours(nextOptimalHour, 0, 0, 0);

      // 各投稿をスケジュール
      for (let i = 0; i < draftPosts.length; i++) {
        const post = draftPosts[i];
        const postScheduleTime = new Date(scheduleTime);
        
        // 投稿間隔を設定（各投稿を2時間間隔で配置）
        if (i > 0) {
          const hoursToAdd = Math.floor(i / optimalHours.length) * 24 + 
                           (optimalHours.indexOf(optimalHours[i % optimalHours.length]) - 
                            optimalHours.indexOf(nextOptimalHour)) * 2;
          postScheduleTime.setHours(postScheduleTime.getHours() + hoursToAdd);
        }

        // 投稿をスケジュール状態に更新
        const { error: updateError } = await supabase
          .from('posts')
          .update({
            status: 'scheduled',
            scheduled_for: postScheduleTime.toISOString(),
            auto_schedule: true
          })
          .eq('id', post.id);

        if (updateError) throw updateError;

        // キューに追加
        const { error: queueError } = await supabase
          .from('post_queue')
          .insert({
            user_id: user.id,
            post_id: post.id,
            scheduled_for: postScheduleTime.toISOString(),
            queue_position: i,
            status: 'queued'
          });

        if (queueError) throw queueError;
      }

      toast({
        title: "成功",
        description: `${draftPosts.length}件の投稿を自動スケジュールしました。`,
      });
      
      loadPosts();
    } catch (error) {
      console.error('Error auto-scheduling posts:', error);
      toast({
        title: "エラー",
        description: "自動スケジュールに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          自動スケジューラー
        </CardTitle>
        <CardDescription>
          下書き投稿を最適な時間帯に自動でスケジュールします。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">下書き投稿（未スケジュール）</p>
              <p className="text-sm text-muted-foreground">
                {loading ? "読み込み中..." : `${draftPosts.length}件の投稿が自動スケジュール待ちです`}
              </p>
            </div>
            <Button onClick={loadPosts} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              更新
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">予約済み投稿</p>
              <p className="text-sm text-muted-foreground">
                {loading ? "読み込み中..." : `${scheduledPosts.length}件の投稿が既にスケジュール済みです`}
              </p>
            </div>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {draftPosts.length === 0 && scheduledPosts.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <Info className="h-4 w-4 inline mr-1" />
              すべての投稿は既にスケジュール済みです。新しい下書き投稿を作成すると、ここに表示されます。
            </p>
          </div>
        )}

        <Button 
          onClick={autoSchedulePosts} 
          disabled={scheduling || draftPosts.length === 0}
          className="w-full"
        >
          {scheduling ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              スケジュール中...
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 mr-2" />
              自動スケジュールを実行
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
