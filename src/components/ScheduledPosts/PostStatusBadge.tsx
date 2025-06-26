
import { Badge } from "@/components/ui/badge";
import { isPast, differenceInMinutes } from "date-fns";
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
    return (
      <Badge variant="destructive">
        失敗 {post.retry_count && post.retry_count > 0 && `(${post.retry_count}回試行)`}
      </Badge>
    );
  }
  
  if (post.status === 'scheduled') {
    if (post.scheduled_for) {
      const scheduledTime = new Date(post.scheduled_for);
      const now = new Date();
      
      if (isPast(scheduledTime)) {
        const minutesPast = differenceInMinutes(now, scheduledTime);
        
        if (minutesPast > 60) {
          return <Badge variant="destructive">期限切れ ({Math.floor(minutesPast / 60)}時間前)</Badge>;
        } else {
          return <Badge variant="destructive">期限切れ ({minutesPast}分前)</Badge>;
        }
      }
      
      return <Badge variant="secondary">予約済み</Badge>;
    }
  }
  
  return <Badge variant="outline">下書き</Badge>;
};
