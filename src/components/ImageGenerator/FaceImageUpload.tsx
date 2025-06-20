import { Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FaceImageUploadProps {
  faceImagePreview: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FaceImageUpload = ({ faceImagePreview, onImageChange }: FaceImageUploadProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="face-image">顔写真</Label>
      <div className="flex items-center gap-4">
        <Input
          id="face-image"
          type="file"
          accept="image/*"
          onChange={onImageChange}
          className="flex-1"
        />
        <Upload className="h-4 w-4 text-muted-foreground" />
      </div>
      {faceImagePreview && (
        <div className="mt-4">
          <img
            src={faceImagePreview}
            alt="Face preview"
            className="w-32 h-32 object-cover rounded-lg border"
          />
        </div>
      )}
    </div>
  );
};