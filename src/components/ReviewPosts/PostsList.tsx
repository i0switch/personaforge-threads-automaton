
import { PostCard } from "./PostCard";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];

interface PostsListProps {
  posts: Post[];
  onUpdate: (index: number, content: string) => void;
  onDelete: (index: number) => void;
}

export const PostsList = ({ posts, onUpdate, onDelete }: PostsListProps) => {
  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">投稿一覧</h2>
      {posts.map((post, index) => (
        <PostCard
          key={post.id || index}
          post={post}
          index={index}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
