
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { PostsTableRow } from "./PostsTableRow";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'] & {
  personas?: {
    name: string;
    avatar_url: string | null;
    threads_access_token: string | null;
  };
};

interface PostsTableProps {
  posts: Post[];
  selectedPosts: string[];
  publishingPost: string | null;
  deletingPost: string | null;
  onSelectAll: (checked: boolean) => void;
  onSelectPost: (postId: string, checked: boolean) => void;
  onPublishPost: (postId: string) => void;
  onDeletePost: (postId: string) => void;
}

export const PostsTable = ({
  posts,
  selectedPosts,
  publishingPost,
  deletingPost,
  onSelectAll,
  onSelectPost,
  onPublishPost,
  onDeletePost
}: PostsTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={selectedPosts.length === posts.length && posts.length > 0}
              onCheckedChange={onSelectAll}
              aria-label="全選択"
            />
          </TableHead>
          <TableHead>ペルソナ</TableHead>
          <TableHead>内容</TableHead>
          <TableHead>画像</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>予約日時</TableHead>
          <TableHead>作成日</TableHead>
          <TableHead>アクション</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => (
          <PostsTableRow
            key={post.id}
            post={post}
            isSelected={selectedPosts.includes(post.id)}
            publishingPost={publishingPost}
            deletingPost={deletingPost}
            onSelect={onSelectPost}
            onPublish={onPublishPost}
            onDelete={onDeletePost}
          />
        ))}
      </TableBody>
    </Table>
  );
};
