
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Play, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { PostStatusBadge } from "./PostStatusBadge";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'] & {
  personas?: {
    name: string;
    avatar_url: string | null;
    threads_access_token: string | null;
  };
};

interface PostsTableRowProps {
  post: Post;
  isSelected: boolean;
  publishingPost: string | null;
  deletingPost: string | null;
  onSelect: (postId: string, checked: boolean) => void;
  onPublish: (postId: string) => void;
  onDelete: (postId: string) => void;
}

export const PostsTableRow = ({
  post,
  isSelected,
  publishingPost,
  deletingPost,
  onSelect,
  onPublish,
  onDelete
}: PostsTableRowProps) => {
  const canPublish = post.personas?.threads_access_token && post.status !== 'published';

  return (
    <TableRow key={post.id}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(post.id, checked as boolean)}
          aria-label={`投稿を選択`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={post.personas?.avatar_url || ""} />
            <AvatarFallback>
              {post.personas?.name?.[0] || "P"}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">
            {post.personas?.name || "不明"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-xs">
          <p className="text-sm line-clamp-2">
            {post.content.substring(0, 100)}
            {post.content.length > 100 && "..."}
          </p>
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {post.hashtags.slice(0, 3).map((hashtag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  #{hashtag}
                </Badge>
              ))}
              {post.hashtags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{post.hashtags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        {post.images && post.images.length > 0 ? (
          <div className="flex items-center gap-2">
            <img
              src={post.images[0]}
              alt="Post image"
              className="w-12 h-12 object-cover rounded border"
            />
            {post.images.length > 1 && (
              <Badge variant="outline" className="text-xs">
                +{post.images.length - 1}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded border">
            <ImageIcon className="h-4 w-4 text-gray-400" />
          </div>
        )}
      </TableCell>
      <TableCell>
        <PostStatusBadge post={post} />
      </TableCell>
      <TableCell>
        {post.scheduled_for ? (
          <div className="flex items-center gap-1 text-sm">
            <Clock className="h-4 w-4" />
            {format(new Date(post.scheduled_for), 'MM/dd HH:mm', { locale: ja })}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">未設定</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {format(new Date(post.created_at), 'MM/dd', { locale: ja })}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {canPublish && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPublish(post.id)}
              disabled={publishingPost === post.id}
            >
              {publishingPost === post.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(post.id)}
            disabled={deletingPost === post.id}
          >
            {deletingPost === post.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
