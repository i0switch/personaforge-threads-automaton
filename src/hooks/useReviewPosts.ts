
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];

interface ReviewPostsState {
  posts: Post[];
  persona: Persona;
  scheduledDateTime?: string; // 選択された日時を保持
}

export const useReviewPosts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [scheduledDateTime, setScheduledDateTime] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const state = location.state as ReviewPostsState;
    console.log('ReviewPosts state:', state);
    
    if (state && state.posts && state.persona) {
      setPosts(state.posts);
      setPersona(state.persona);
      
      // 選択された日時があれば保持
      if (state.scheduledDateTime) {
        setScheduledDateTime(state.scheduledDateTime);
        console.log('Scheduled DateTime from state:', state.scheduledDateTime);
      }
      
      setIsLoading(false);
    } else {
      console.log('No state found, redirecting to create-posts');
      toast({
        title: "エラー",
        description: "投稿データが見つかりません。投稿作成画面に戻ります。",
        variant: "destructive",
      });
      navigate("/create-posts");
    }
  }, [location.state, navigate, toast]);

  const updatePost = (index: number, content: string) => {
    const updatedPosts = [...posts];
    updatedPosts[index] = { ...updatedPosts[index], content };
    setPosts(updatedPosts);
  };

  const deletePost = (index: number) => {
    setPosts(posts.filter((_, i) => i !== index));
  };

  const scheduleAllPosts = async () => {
    if (posts.length === 0 || !persona) return;

    setIsScheduling(true);
    try {
      // 選択された日時があれば使用、なければデフォルト処理
      let baseScheduleTime = scheduledDateTime ? new Date(scheduledDateTime) : new Date();
      
      // デフォルトのスケジュール時刻設定（日時が選択されていない場合）
      if (!scheduledDateTime) {
        baseScheduleTime.setHours(baseScheduleTime.getHours() + 1, 0, 0, 0);
      }

      console.log('Base schedule time:', baseScheduleTime.toISOString());

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const postScheduleTime = new Date(baseScheduleTime);
        
        // 複数投稿の場合は30分間隔で配置
        if (i > 0) {
          postScheduleTime.setMinutes(postScheduleTime.getMinutes() + (i * 30));
        }

        console.log(`Scheduling post ${i + 1} for:`, postScheduleTime.toISOString());

        const { error } = await supabase
          .from('posts')
          .update({ 
            content: post.content,
            status: 'scheduled',
            scheduled_for: postScheduleTime.toISOString()
          })
          .eq('id', post.id);

        if (error) throw error;

        // キューにも追加
        const { error: queueError } = await supabase
          .from('post_queue')
          .insert({
            user_id: user!.id,
            post_id: post.id,
            scheduled_for: postScheduleTime.toISOString(),
            queue_position: i,
            status: 'queued'
          });

        if (queueError) {
          console.error('Queue insertion error:', queueError);
          // キューエラーは警告として扱い、処理を続行
        }
      }

      // Log activity
      if (user) {
        await supabase
          .from('activity_logs')
          .insert({
            user_id: user.id,
            persona_id: persona.id,
            action_type: 'posts_scheduled',
            description: `${posts.length}件の投稿を予約しました`
          });
      }

      toast({
        title: "成功",
        description: `${posts.length}件の投稿を予約しました。`,
      });

      navigate("/scheduled-posts");
    } catch (error) {
      console.error('Error scheduling posts:', error);
      toast({
        title: "エラー",
        description: "投稿の予約に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  };

  return {
    posts,
    persona,
    scheduledDateTime,
    isScheduling,
    isLoading,
    updatePost,
    deletePost,
    scheduleAllPosts,
    navigate
  };
};
