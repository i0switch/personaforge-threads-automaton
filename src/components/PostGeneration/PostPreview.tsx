
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface PostPreviewProps {
  posts: any[];
  personaId: string;
  selectedDates: string[];
  selectedTimes: string[];
  onPostsSaved: () => void;
}

export const PostPreview = ({ posts, personaId, selectedDates, selectedTimes, onPostsSaved }: PostPreviewProps) => {
  const [editedPosts, setEditedPosts] = useState(
    posts.map(post => ({ ...post, content: post.content }))
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleContentChange = (index: number, newContent: string) => {
    setEditedPosts(prev => 
      prev.map((post, i) => 
        i === index ? { ...post, content: newContent } : post
      )
    );
  };

  const handleSavePosts = async () => {
    try {
      setSaving(true);
      
      const updates = editedPosts.map(post => ({
        id: post.id,
        content: post.content
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('posts')
          .update({ content: update.content })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: "成功",
        description: `${editedPosts.length}件の投稿を保存しました。`,
      });

      onPostsSaved();
    } catch (error) {
      console.error('Error saving posts:', error);
      toast({
        title: "エラー",
        description: "投稿の保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatScheduledTime = (scheduledFor: string) => {
    const date = new Date(scheduledFor);
    return format(date, "M月d日 HH:mm", { locale: ja });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">生成された投稿</h2>
          <p className="text-muted-foreground">
            {editedPosts.length}件の投稿が生成されました。内容を確認・編集してから保存してください。
          </p>
        </div>
        <Button onClick={handleSavePosts} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              すべて保存
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4">
        {editedPosts.map((post, index) => (
          <Card key={post.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex items-center gap-4">
                  <Badge variant="outline">投稿 {index + 1}</Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <Clock className="h-4 w-4" />
                    {formatScheduledTime(post.scheduled_for)}
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={post.content}
                onChange={(e) => handleContentChange(index, e.target.value)}
                className="min-h-[120px]"
                placeholder="投稿内容を編集..."
              />
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {post.hashtags.map((tag: string, tagIndex: number) => (
                    <Badge key={tagIndex} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
