
import { PostReviewCard } from "./PostReviewCard";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];

interface PostsNeedingReviewProps {
  postsNeedingReview: Post[];
  onApprove: (postId: string) => void;
}

export const PostsNeedingReview = ({ postsNeedingReview, onApprove }: PostsNeedingReviewProps) => {
  if (postsNeedingReview.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-blue-600">画像レビューが必要な投稿</h2>
      {postsNeedingReview.map((post) => (
        <PostReviewCard 
          key={post.id} 
          post={post} 
          onApprove={onApprove}
        />
      ))}
    </div>
  );
};
