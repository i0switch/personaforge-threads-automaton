import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PersonaHeader } from "@/components/ReviewPosts/PersonaHeader";
import { PostsNeedingImageGeneration } from "@/components/ReviewPosts/PostsNeedingImageGeneration";
import { PostsNeedingReview } from "@/components/ReviewPosts/PostsNeedingReview";
import { PostsList } from "@/components/ReviewPosts/PostsList";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];

interface ReviewPostsState {
  posts: Post[];
  persona: Persona;
}

const ReviewPosts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewedPosts, setReviewedPosts] = useState<string[]>([]);

  useEffect(() => {
    console.log('ReviewPosts: Component mounted, checking location state');
    
    try {
      const state = location.state as ReviewPostsState;
      console.log('ReviewPosts: Raw location state:', state);
      
      if (state && state.posts && state.persona) {
        console.log('ReviewPosts: Setting posts:', state.posts.length, 'and persona:', state.persona.name);
        setPosts(state.posts);
        setPersona(state.persona);
        setError(null);
      } else {
        console.error('ReviewPosts: Invalid state - redirecting to create-posts');
        console.log('ReviewPosts: State structure:', {
          hasState: !!state,
          hasPosts: state?.posts ? 'yes' : 'no',
          hasPersona: state?.persona ? 'yes' : 'no'
        });
        setError('投稿データが見つかりません。');
        navigate("/create-posts");
      }
    } catch (error) {
      console.error('ReviewPosts: Error processing state:', error);
      setError('投稿データの読み込みに失敗しました。');
      toast({
        title: "エラー",
        description: "投稿データの読み込みに失敗しました。",
        variant: "destructive",
      });
      navigate("/create-posts");
    }
  }, [location.state, navigate, toast]);

  // 画像生成が必要な投稿を計算
  const postsNeedingImageGeneration = posts.filter(post => {
    const hasImages = post.images && post.images.length > 0;
    return !hasImages;
  });

  // レビューが必要な投稿を計算（画像があってまだレビューされていない投稿）
  const postsNeedingReview = posts.filter(post => {
    const hasImages = post.images && post.images.length > 0;
    const isReviewed = reviewedPosts.includes(post.id);
    return hasImages && !isReviewed;
  });

  // すべての画像がレビュー済みかどうか
  const allImagesReviewed = postsNeedingImageGeneration.length === 0 && postsNeedingReview.length === 0;

  console.log('=== Current State Debug ===');
  console.log('Posts needing image generation:', postsNeedingImageGeneration.length);
  console.log('Posts needing review:', postsNeedingReview.map(p => p.id));
  console.log('Reviewed posts:', reviewedPosts);
  console.log('All images reviewed:', allImagesReviewed);

  posts.forEach(post => {
    const hasImages = post.images && post.images.length > 0;
    const isReviewed = reviewedPosts.includes(post.id);
    const needsReview = hasImages && !isReviewed;
    console.log(`Post ${post.id}: hasImages=${hasImages}, isReviewed=${isReviewed}, needsReview=${needsReview}`);
  });

  const updatePost = (index: number, content: string) => {
    try {
      console.log('ReviewPosts: Updating post', index, 'with content length:', content.length);
      const updatedPosts = [...posts];
      updatedPosts[index] = { ...updatedPosts[index], content };
      setPosts(updatedPosts);
      console.log('ReviewPosts: Post updated successfully');
    } catch (error) {
      console.error('ReviewPosts: Error updating post:', error);
      setError('投稿の更新に失敗しました。');
      toast({
        title: "エラー",
        description: "投稿の更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const deletePost = (index: number) => {
    try {
      console.log('ReviewPosts: Deleting post at index:', index);
      const newPosts = posts.filter((_, i) => i !== index);
      setPosts(newPosts);
      console.log('ReviewPosts: Post deleted, remaining posts:', newPosts.length);
      toast({
        title: "投稿を削除しました",
        description: "投稿が削除されました。",
      });
    } catch (error) {
      console.error('ReviewPosts: Error deleting post:', error);
      setError('投稿の削除に失敗しました。');
      toast({
        title: "エラー",
        description: "投稿の削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const updatePostImages = (postIndex: number, images: string[]) => {
    try {
      console.log('ReviewPosts: Updating post images for post', postIndex, 'with images:', images.length);
      const updatedPosts = [...posts];
      updatedPosts[postIndex] = { ...updatedPosts[postIndex], images: images };
      setPosts(updatedPosts);
      
      toast({
        title: "成功",
        description: "画像を投稿に追加しました。",
      });
      console.log('ReviewPosts: Images updated successfully');
    } catch (error) {
      console.error('ReviewPosts: Error updating post images:', error);
      setError('画像の追加に失敗しました。');
      toast({
        title: "エラー",
        description: "画像の追加に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const approveGeneratedImage = (postId: string) => {
    console.log('=== Approving generated image ===');
    console.log('Post ID:', postId);
    
    setReviewedPosts(prev => {
      const newReviewed = [...prev, postId];
      console.log('After approval - Reviewed posts:', newReviewed);
      return newReviewed;
    });
    
    toast({
      title: "承認完了",
      description: "生成された画像を承認しました。",
    });
  };

  const scheduleAllPosts = async () => {
    if (posts.length === 0 || !persona) {
      console.log('ReviewPosts: Cannot schedule - no posts or persona');
      return;
    }

    setIsScheduling(true);
    setError(null);
    
    try {
      console.log('ReviewPosts: Starting to schedule posts:', posts.length);
      
      const postsToUpdate = posts.map(post => ({
        id: post.id,
        content: post.content,
        status: 'scheduled' as const
      }));

      for (const post of postsToUpdate) {
        console.log('ReviewPosts: Updating post:', post.id);
        const { error } = await supabase
          .from('posts')
          .update({ 
            content: post.content,
            status: post.status 
          })
          .eq('id', post.id);

        if (error) {
          console.error('ReviewPosts: Error updating post:', error);
          throw error;
        }
      }

      // Log activity
      console.log('ReviewPosts: Logging activity');
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user!.id,
          persona_id: persona.id,
          action_type: 'posts_scheduled',
          description: `${posts.length}件の投稿を予約しました`
        });

      console.log('ReviewPosts: Posts scheduled successfully');
      toast({
        title: "成功",
        description: `${posts.length}件の投稿を予約しました。`,
      });

      navigate("/scheduled-posts");
    } catch (error) {
      console.error('ReviewPosts: Error scheduling posts:', error);
      setError('投稿の予約に失敗しました。');
      toast({
        title: "エラー",
        description: "投稿の予約に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  };

  // Show error state
  if (error && !persona) {
    console.log('ReviewPosts: Rendering error state');
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">エラーが発生しました</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => navigate("/create-posts")}>
                  投稿作成に戻る
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (!persona) {
    console.log('ReviewPosts: Rendering loading state');
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>読み込み中...</span>
          </div>
        </div>
      </div>
    );
  }

  console.log('ReviewPosts: Rendering main content with persona:', persona.name, 'and posts:', posts.length);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/create-posts")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">生成投稿確認</h1>
            <p className="text-muted-foreground">生成された投稿を確認・修正してください</p>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <Card>
            <CardContent className="p-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ペルソナ情報 */}
        <PersonaHeader
          persona={persona}
          totalPosts={posts.length}
          postsNeedingImageGeneration={postsNeedingImageGeneration.length}
          postsNeedingReview={postsNeedingReview.length}
        />

        {/* 画像生成が必要な場合の表示 */}
        <PostsNeedingImageGeneration
          postsNeedingImageGeneration={postsNeedingImageGeneration}
          posts={posts}
          onImagesGenerated={updatePostImages}
        />

        {/* レビューが必要な投稿の表示 */}
        <PostsNeedingReview
          postsNeedingReview={postsNeedingReview}
          onApprove={approveGeneratedImage}
        />

        {/* 通常の投稿一覧（すべての画像がレビュー済みの場合） */}
        {allImagesReviewed && (
          <PostsList
            posts={posts}
            onUpdate={updatePost}
            onDelete={deletePost}
          />
        )}

        {/* 投稿がない場合 */}
        {posts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">表示する投稿がありません。</p>
              <Button onClick={() => navigate("/create-posts")} className="mt-4">
                投稿を作成する
              </Button>
            </CardContent>
          </Card>
        )}

        {/* アクションボタン */}
        {allImagesReviewed && posts.length > 0 && (
          <div className="flex gap-4">
            <Button 
              onClick={scheduleAllPosts} 
              disabled={isScheduling || posts.length === 0}
              className="flex-1"
              size="lg"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  予約中...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  投稿を予約する
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPosts;
