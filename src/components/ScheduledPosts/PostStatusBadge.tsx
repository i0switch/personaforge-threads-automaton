
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
  if (post.status === 'scheduled') {
    // 予約時間を過ぎているかチェック（現在時刻と比較）
    if (post.scheduled_for && isPast(new Date(post.scheduled_for))) {
      return <Badge variant="destructive">期限切れ</Badge>;
    }
    return <Badge variant="secondary">予約済み</Badge>;
  }
  return <Badge variant="outline">下書き</Badge>;
};
