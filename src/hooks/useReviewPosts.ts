
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
}

export const useReviewPosts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const state = location.state as ReviewPostsState;
    console.log('ReviewPosts state:', state);
    
    if (state && state.posts && state.persona) {
      setPosts(state.posts);
      setPersona(state.persona);
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
      const postsToUpdate = posts.map(post => ({
        id: post.id,
        content: post.content,
        status: 'scheduled' as const
      }));

      for (const post of postsToUpdate) {
        const { error } = await supabase
          .from('posts')
          .update({ 
            content: post.content,
            status: post.status 
          })
          .eq('id', post.id);

        if (error) throw error;
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
    isScheduling,
    isLoading,
    updatePost,
    deletePost,
    scheduleAllPosts,
    navigate
  };
};
