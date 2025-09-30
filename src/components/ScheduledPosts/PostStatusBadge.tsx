
import { Badge } from "@/components/ui/badge";
import { isPast } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'] & {
  personas?: {
    name: string;
    avatar_url: string | null;
    threads_access_token: string | null;
  };
};

interface PostStatusBadgeProps {
  post: Post;
}

export const PostStatusBadge = ({ post }: PostStatusBadgeProps) => {
  if (post.status === 'published') {
    return <Badge variant="default">公開済み</Badge>;
  }
  
  if (post.status === 'failed') {
    return <Badge variant="destructive">失敗</Badge>;
  }
  
  if (post.status === 'processing') {
    return <Badge variant="secondary">処理中</Badge>;
  }
  
  if (post.status === 'scheduled') {
    if (post.scheduled_for && isPast(new Date(post.scheduled_for))) {
      // 予約時刻を過ぎている場合は、処理中として表示
      return <Badge variant="secondary">処理中</Badge>;
    }
    return <Badge variant="secondary">予約済み</Badge>;
  }
  
  // draft状態は廃止されたため、エラーとして表示
  return <Badge variant="destructive">エラー</Badge>;
};
