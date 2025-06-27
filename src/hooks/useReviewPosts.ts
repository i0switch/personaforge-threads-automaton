
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
  originalSettings?: {
    selectedDates: Date[];
    selectedTimes: string[];
    topics: string[];
  };
}

export const useReviewPosts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [originalSettings, setOriginalSettings] = useState<any>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const state = location.state as ReviewPostsState;
    console.log('ReviewPosts state:', state);
    
    if (state && state.posts && state.persona) {
      setPosts(state.posts);
      setPersona(state.persona);
      
      // 元の設定データがあれば保持
      if (state.originalSettings) {
        setOriginalSettings(state.originalSettings);
        console.log('Original settings:', state.originalSettings);
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
      // 投稿を既存のスケジュール時間のまま保存
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];

        console.log(`Scheduling post ${i + 1} for:`, post.scheduled_for);

        const { error } = await supabase
          .from('posts')
          .update({ 
            content: post.content,
            status: 'scheduled',
            // scheduled_forは既に正しい時間が設定されているのでそのまま使用
            scheduled_for: post.scheduled_for
          })
          .eq('id', post.id);

        if (error) throw error;

        // キューにも追加
        const { error: queueError } = await supabase
          .from('post_queue')
          .insert({
            user_id: user!.id,
            post_id: post.id,
            scheduled_for: post.scheduled_for,
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
    originalSettings,
    isScheduling,
    isLoading,
    updatePost,
    deletePost,
    scheduleAllPosts,
    navigate
  };
};
