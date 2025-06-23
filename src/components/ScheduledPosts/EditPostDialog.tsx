
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Edit, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'] & {
  personas?: {
    name: string;
    avatar_url: string | null;
    threads_access_token: string | null;
  };
};

interface EditPostDialogProps {
  post: Post;
  onSave: (postId: string, updates: Partial<Post>) => Promise<void>;
  saving: boolean;
}

export const EditPostDialog = ({ post, onSave, saving }: EditPostDialogProps) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(post.content);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    post.scheduled_for ? new Date(post.scheduled_for) : undefined
  );
  const [hashtags, setHashtags] = useState(post.hashtags?.join(', ') || '');

  useEffect(() => {
    if (open) {
      setContent(post.content);
      setScheduledDate(post.scheduled_for ? new Date(post.scheduled_for) : undefined);
      setHashtags(post.hashtags?.join(', ') || '');
    }
  }, [open, post]);

  const handleSave = async () => {
    const updates: Partial<Post> = {
      content,
      scheduled_for: scheduledDate?.toISOString(),
      hashtags: hashtags ? hashtags.split(',').map(tag => tag.trim()).filter(Boolean) : null
    };

    await onSave(post.id, updates);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Edit className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>投稿を編集</DialogTitle>
          <DialogDescription>
            投稿内容やスケジュールを編集できます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="content">投稿内容</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px]"
              placeholder="投稿内容を入力..."
            />
          </div>
          
          <div>
            <Label htmlFor="hashtags">ハッシュタグ</Label>
            <Input
              id="hashtags"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#tag1, #tag2, #tag3"
            />
          </div>
          
          <div>
            <Label>予約日時</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? (
                    format(scheduledDate, "PPP HH:mm", { locale: ja })
                  ) : (
                    <span>日時を選択</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
