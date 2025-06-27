
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
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
    if (post.scheduled_for) {
      // UTCから日本時間に変換
      const utcDate = new Date(post.scheduled_for);
      const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
      const now = new Date();
      
      // 現在時刻も日本時間に変換
      const nowJst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      
      // 5分の猶予を設けて期限切れ判定
      const gracePeriod = 5 * 60 * 1000; // 5分をミリ秒で
      const isOverdue = (nowJst.getTime() - jstDate.getTime()) > gracePeriod;
      
      if (isOverdue) {
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant="destructive">期限切れ</Badge>
            <span className="text-xs text-muted-foreground">
              予定: {format(jstDate, 'MM/dd HH:mm', { locale: ja })}
            </span>
          </div>
        );
      }
      
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="secondary">予約済み</Badge>
          <span className="text-xs text-muted-foreground">
            {format(jstDate, 'MM/dd HH:mm', { locale: ja })}
          </span>
        </div>
      );
    }
    return <Badge variant="secondary">予約済み</Badge>;
  }
  
  return <Badge variant="outline">下書き</Badge>;
};
