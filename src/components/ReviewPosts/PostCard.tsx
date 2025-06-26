
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];

interface PostCardProps {
  post: Post;
  index: number;
  onUpdate: (index: number, content: string) => void;
  onDelete: (index: number) => void;
}

export const PostCard = ({ post, index, onUpdate, onDelete }: PostCardProps) => {
  return (
    <Card>
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
              onClick={() => onDelete(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={post.content || ''}
          onChange={(e) => onUpdate(index, e.target.value)}
          rows={4}
          placeholder="投稿内容を編集..."
        />
        
        {/* 画像プレビュー */}
        {post.images && post.images.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">添付画像:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {post.images.map((imageUrl, imageIndex) => (
                <div key={`image-${imageIndex}`} className="relative">
                  <img
                    src={imageUrl}
                    alt={`画像 ${imageIndex + 1}`}
                    className="w-full max-w-md mx-auto rounded-lg border object-cover"
                    style={{ maxHeight: '300px' }}
                    onError={(e) => {
                      console.error('PostCard: Failed to load image:', imageUrl);
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
  );
};
