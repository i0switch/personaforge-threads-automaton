import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Edit, Loader2, Upload, X, Image as ImageIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(post.content);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    post.scheduled_for ? new Date(post.scheduled_for) : undefined
  );
  const [scheduledHour, setScheduledHour] = useState<string>(() => {
    if (post.scheduled_for) {
      return new Date(post.scheduled_for).getHours().toString().padStart(2, '0');
    }
    return '09';
  });
  const [scheduledMinute, setScheduledMinute] = useState<string>(() => {
    if (post.scheduled_for) {
      return new Date(post.scheduled_for).getMinutes().toString().padStart(2, '0');
    }
    return '00';
  });
  const [hashtags, setHashtags] = useState(post.hashtags?.join(', ') || '');
  const [images, setImages] = useState<string[]>(post.images || []);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(post.content);
      setScheduledDate(post.scheduled_for ? new Date(post.scheduled_for) : undefined);
      if (post.scheduled_for) {
        const date = new Date(post.scheduled_for);
        setScheduledHour(date.getHours().toString().padStart(2, '0'));
        setScheduledMinute(date.getMinutes().toString().padStart(2, '0'));
      } else {
        setScheduledHour('09');
        setScheduledMinute('00');
      }
      setHashtags(post.hashtags?.join(', ') || '');
      setImages(post.images || []);
    }
  }, [open, post]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('persona-avatars')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('persona-avatars')
          .getPublicUrl(fileName);

        return publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setImages(prev => [...prev, ...uploadedUrls]);
      
      toast({
        title: "成功",
        description: "画像をアップロードしました。",
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({
        title: "エラー",
        description: "画像のアップロードに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    let scheduledFor: string | undefined;
    
    if (scheduledDate) {
      const combinedDateTime = new Date(scheduledDate);
      combinedDateTime.setHours(parseInt(scheduledHour), parseInt(scheduledMinute), 0, 0);
      scheduledFor = combinedDateTime.toISOString();
    }

    const updates: Partial<Post> = {
      content,
      scheduled_for: scheduledFor,
      hashtags: hashtags ? hashtags.split(',').map(tag => tag.trim()).filter(Boolean) : null,
      images: images.length > 0 ? images : null
    };

    await onSave(post.id, updates);
    setOpen(false);
  };

  // Generate hour options (00-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => 
    i.toString().padStart(2, '0')
  );

  // Generate minute options (00-59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => 
    i.toString().padStart(2, '0')
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Edit className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <Label>画像</Label>
            <div className="space-y-3">
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((imageUrl, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={imageUrl}
                        alt={`Image ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                  id="image-upload"
                />
                <Label
                  htmlFor="image-upload"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent",
                    uploadingImage && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadingImage ? "アップロード中..." : "画像を追加"}
                </Label>
                {images.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                    画像なし
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <Label>予約日時</Label>
            
            {/* Date Selection */}
            <div>
              <Label className="text-sm text-muted-foreground">日付</Label>
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
                      format(scheduledDate, "yyyy年MM月dd日", { locale: ja })
                    ) : (
                      <span>日付を選択</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground">時</Label>
                <Select value={scheduledHour} onValueChange={setScheduledHour}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {scheduledHour}時
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}時
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">分</Label>
                <Select value={scheduledMinute} onValueChange={setScheduledMinute}>
                  <SelectTrigger>
                    <SelectValue>
                      {scheduledMinute}分
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map((minute) => (
                      <SelectItem key={minute} value={minute}>
                        {minute}分
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Combined Date/Time Preview */}
            {scheduledDate && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">予約日時プレビュー</p>
                <p className="font-medium">
                  {format(scheduledDate, "yyyy年MM月dd日", { locale: ja })} {scheduledHour}:{scheduledMinute}
                </p>
              </div>
            )}
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
