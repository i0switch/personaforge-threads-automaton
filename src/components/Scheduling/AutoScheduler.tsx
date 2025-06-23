
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, Clock, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];

export const AutoScheduler = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [draftPosts, setDraftPosts] = useState<Post[]>([]);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    loadDraftPosts();
  }, [user]);

  const loadDraftPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .is('scheduled_for', null);

      if (error) throw error;
      setDraftPosts(data || []);
    } catch (error) {
      console.error('Error loading draft posts:', error);
      toast({
        title: "エラー",
        description: "下書き投稿の読み込みに失敗しました。",
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
      
      loadDraftPosts();
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
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">下書き投稿</p>
            <p className="text-sm text-muted-foreground">
              {loading ? "読み込み中..." : `${draftPosts.length}件の投稿が自動スケジュール待ちです`}
            </p>
          </div>
          <Button onClick={loadDraftPosts} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            更新
          </Button>
        </div>

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
