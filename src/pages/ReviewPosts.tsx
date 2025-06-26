
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Trash2, Calendar, Clock, Image as ImageIcon, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ImageGenerationSection } from "@/components/ReviewPosts/ImageGenerationSection";
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
  const [showImageGeneration, setShowImageGeneration] = useState(false);
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
    const hasUploaded = post.image_urls && post.image_urls.length > 0;
    const hasGenerated = post.generated_images && post.generated_images.length > 0;
    return !hasUploaded && !hasGenerated;
  });

  // レビューが必要な投稿を計算（画像生成済みでまだレビューされていない投稿）
  const postsNeedingReview = posts.filter(post => {
    const hasGenerated = post.generated_images && post.generated_images.length > 0;
    const isReviewed = reviewedPosts.includes(post.id);
    return hasGenerated && !isReviewed;
  });

  // すべての画像がレビュー済みかどうか
  const allImagesReviewed = postsNeedingImageGeneration.length === 0 && postsNeedingReview.length === 0;

  console.log('=== Current State Debug ===');
  console.log('Posts needing image generation:', postsNeedingImageGeneration.length);
  console.log('Posts needing review:', postsNeedingReview.map(p => p.id));
  console.log('Reviewed posts:', reviewedPosts);
  console.log('All images reviewed:', allImagesReviewed);

  posts.forEach(post => {
    const hasUploaded = post.image_urls && post.image_urls.length > 0;
    const hasGenerated = post.generated_images && post.generated_images.length > 0;
    const isReviewed = reviewedPosts.includes(post.id);
    const needsReview = hasGenerated && !isReviewed;
    console.log(`Post ${post.id}: hasUploaded=${hasUploaded}, hasGenerated=${hasGenerated}, isReviewed=${isReviewed}, needsReview=${needsReview}`);
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
      updatedPosts[postIndex] = { ...updatedPosts[postIndex], generated_images: images };
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={persona.avatar_url || ""} />
                <AvatarFallback>{persona.name[0]}</AvatarFallback>
              </Avatar>
              {persona.name}
            </CardTitle>
            <CardDescription>
              生成された投稿: {posts.length}件
              {postsNeedingImageGeneration.length > 0 && (
                <span className="block text-orange-600 mt-1">
                  画像生成が必要な投稿: {postsNeedingImageGeneration.length}件
                </span>
              )}
              {postsNeedingReview.length > 0 && (
                <span className="block text-blue-600 mt-1">
                  画像レビューが必要な投稿: {postsNeedingReview.length}件
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 画像生成が必要な場合の表示 */}
        {postsNeedingImageGeneration.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600">画像生成が必要です</CardTitle>
              <CardDescription>
                {postsNeedingImageGeneration.length}件の投稿に画像を生成してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setShowImageGeneration(!showImageGeneration)}
                className="w-full"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                {showImageGeneration ? '画像生成を閉じる' : '投稿用画像を生成'}
              </Button>
              
              {showImageGeneration && (
                <div className="mt-4">
                  <ImageGenerationSection
                    onImagesGenerated={(images) => {
                      console.log('ReviewPosts: Images generated:', images.length);
                      // 最初の画像生成が必要な投稿に追加
                      if (postsNeedingImageGeneration.length > 0) {
                        const postIndex = posts.findIndex(p => p.id === postsNeedingImageGeneration[0].id);
                        if (postIndex !== -1) {
                          updatePostImages(postIndex, images);
                        }
                      }
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* レビューが必要な投稿の表示 */}
        {postsNeedingReview.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-blue-600">画像レビューが必要な投稿</h2>
            {postsNeedingReview.map((post, index) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">投稿レビュー</CardTitle>
                    <Badge variant="outline" className="bg-blue-50">レビュー待ち</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm font-medium mb-2">投稿内容:</p>
                    <p className="whitespace-pre-wrap">{post.content}</p>
                  </div>
                  
                  {post.generated_images && post.generated_images.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">生成された画像:</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {post.generated_images.map((imageUrl, imageIndex) => (
                          <div key={imageIndex} className="relative">
                            <img
                              src={imageUrl}
                              alt={`生成画像 ${imageIndex + 1}`}
                              className="w-full max-w-md mx-auto rounded-lg border object-cover"
                              style={{ maxHeight: '300px' }}
                              onError={(e) => {
                                console.error('ReviewPosts: Failed to load image:', imageUrl);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <Button 
                        onClick={() => approveGeneratedImage(post.id)}
                        className="w-full"
                      >
                        この画像を承認する
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 通常の投稿一覧（すべての画像がレビュー済みの場合） */}
        {allImagesReviewed && posts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">投稿一覧</h2>
            {posts.map((post, index) => (
              <Card key={post.id || index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">投稿 {index + 1}</CardTitle>
                    <div className="flex items-center gap-2">
                      {post.scheduled_for && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(post.scheduled_for), 'MM/dd', { locale: ja })}
                          <Clock className="h-3 w-3 ml-1" />
                          {format(new Date(post.scheduled_for), 'HH:mm', { locale: ja })}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deletePost(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={post.content || ''}
                    onChange={(e) => updatePost(index, e.target.value)}
                    rows={4}
                    placeholder="投稿内容を編集..."
                  />
                  
                  {/* 画像プレビュー */}
                  {((post.image_urls && post.image_urls.length > 0) || (post.generated_images && post.generated_images.length > 0)) && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">添付画像:</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* アップロード画像 */}
                        {post.image_urls && post.image_urls.map((imageUrl, imageIndex) => (
                          <div key={`upload-${imageIndex}`} className="relative">
                            <img
                              src={imageUrl}
                              alt={`アップロード画像 ${imageIndex + 1}`}
                              className="w-full max-w-md mx-auto rounded-lg border object-cover"
                              style={{ maxHeight: '300px' }}
                              onError={(e) => {
                                console.error('ReviewPosts: Failed to load image:', imageUrl);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                        {/* 生成画像 */}
                        {post.generated_images && post.generated_images.map((imageUrl, imageIndex) => (
                          <div key={`generated-${imageIndex}`} className="relative">
                            <img
                              src={imageUrl}
                              alt={`生成画像 ${imageIndex + 1}`}
                              className="w-full max-w-md mx-auto rounded-lg border object-cover"
                              style={{ maxHeight: '300px' }}
                              onError={(e) => {
                                console.error('ReviewPosts: Failed to load image:', imageUrl);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
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
