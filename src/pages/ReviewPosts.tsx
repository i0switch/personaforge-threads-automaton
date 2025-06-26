
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ReviewPostsHeader } from "@/components/ReviewPosts/ReviewPostsHeader";
import { PersonaInfoCard } from "@/components/ReviewPosts/PersonaInfoCard";
import { PostEditCard } from "@/components/ReviewPosts/PostEditCard";
import { ScheduleActionButton } from "@/components/ReviewPosts/ScheduleActionButton";
import { useReviewPosts } from "@/hooks/useReviewPosts";

const ReviewPosts = () => {
  const {
    posts,
    persona,
    isScheduling,
    isLoading,
    updatePost,
    deletePost,
    scheduleAllPosts,
    navigate
  } = useReviewPosts();

  if (isLoading) {
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

  if (!persona || posts.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">投稿データが見つかりません。</p>
              <Button onClick={() => navigate("/create-posts")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                投稿作成に戻る
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <ReviewPostsHeader />
        
        <PersonaInfoCard persona={persona} postCount={posts.length} />

        {/* 投稿一覧 */}
        <div className="space-y-4">
          {posts.map((post, index) => (
            <PostEditCard
              key={index}
              post={post}
              index={index}
              onUpdate={updatePost}
              onDelete={deletePost}
            />
          ))}
        </div>

        <ScheduleActionButton 
          onSchedule={scheduleAllPosts}
          isScheduling={isScheduling}
          postCount={posts.length}
        />
      </div>
    </div>
  );
};

export default ReviewPosts;
