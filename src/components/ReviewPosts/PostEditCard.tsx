
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit3, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];

interface PostEditCardProps {
  post: Post;
  index: number;
  onUpdate: (index: number, content: string) => void;
  onDelete: (index: number) => void;
}

export const PostEditCard = ({ post, index, onUpdate, onDelete }: PostEditCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  const handleSave = () => {
    onUpdate(index, editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(post.content);
    setIsEditing(false);
  };

  const formatScheduledTime = (scheduledFor: string | null) => {
    if (!scheduledFor) return "未設定";
    
    try {
      // UTCの時間を日本時間で表示
      const utcDate = new Date(scheduledFor);
      
      // 日本時間に変換
      const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
      
      return format(jstDate, "M月d日 HH:mm", { locale: ja });
    } catch (error) {
      console.error("Date formatting error:", error);
      return "日時エラー";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">
            {formatScheduledTime(post.scheduled_for)}
          </CardTitle>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onDelete(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[120px]"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {post.content}
          </p>
        )}
        
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {post.hashtags.map((hashtag, hashtagIndex) => (
              <Badge key={hashtagIndex} variant="secondary" className="text-xs">
                #{hashtag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
