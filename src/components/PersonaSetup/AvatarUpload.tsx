
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AvatarUploadProps {
  personaId?: string;
  currentAvatarUrl?: string;
  onAvatarChange: (url: string) => void;
}

export const AvatarUpload = ({ personaId, currentAvatarUrl, onAvatarChange }: AvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl || "");
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "エラー",
          description: "画像ファイルを選択してください。",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "エラー",
          description: "ファイルサイズは5MB以下にしてください。",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証が必要です');

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${personaId || 'temp'}_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('persona-avatars')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('persona-avatars')
        .getPublicUrl(fileName);

      setPreviewUrl(publicUrl);
      onAvatarChange(publicUrl);

      toast({
        title: "成功",
        description: "アバター画像がアップロードされました。",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "エラー",
        description: "画像のアップロードに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl("");
    onAvatarChange("");
  };

  return (
    <div className="space-y-4">
      <Label>アバター画像</Label>
      
      {previewUrl ? (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="アバター"
            className="w-32 h-32 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2"
            onClick={handleRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="w-32 h-32 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <div className="flex items-center gap-4">
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="max-w-xs"
        />
        {uploading && <span className="text-sm text-muted-foreground">アップロード中...</span>}
      </div>
      
      <p className="text-xs text-muted-foreground">
        JPG、PNG、GIF形式に対応。最大5MBまで。
      </p>
    </div>
  );
};
