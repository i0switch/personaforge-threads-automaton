
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useImageGenerator } from "@/hooks/useImageGenerator";
import { GeneratedImageDisplay } from "@/components/ImageGenerator/GeneratedImageDisplay";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageGenerationSectionProps {
  onImagesGenerated: (images: string[]) => void;
}

export const ImageGenerationSection = ({ onImagesGenerated }: ImageGenerationSectionProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const {
    faceImage,
    faceImagePreview,
    subject,
    additionalPrompt,
    generating,
    generatedImage,
    handleFaceImageChange,
    generateImage,
    downloadImage,
    setSubject,
    setAdditionalPrompt
  } = useImageGenerator();

  console.log('ImageGenerationSection: Component state:', {
    isGenerating,
    generating,
    generatedImages: generatedImages.length,
    hasGeneratedImage: !!generatedImage,
    error
  });

  const handleGenerateForPosts = async () => {
    console.log('ImageGenerationSection: Starting image generation');
    setError(null);
    
    try {
      setIsGenerating(true);
      await generateImage();
      console.log('ImageGenerationSection: Image generation completed');
    } catch (error) {
      console.error('ImageGenerationSection: Error generating image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`画像生成に失敗しました: ${errorMessage}`);
      toast({
        title: "エラー",
        description: "画像生成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddToPost = () => {
    console.log('ImageGenerationSection: Adding image to post');
    
    if (generatedImage) {
      try {
        const newImages = [...generatedImages, generatedImage];
        setGeneratedImages(newImages);
        onImagesGenerated(newImages);
        
        console.log('ImageGenerationSection: Image added successfully, total images:', newImages.length);
        toast({
          title: "成功",
          description: "画像を投稿に追加しました。",
        });
        setError(null);
      } catch (error) {
        console.error('ImageGenerationSection: Error adding image to post:', error);
        setError('画像の追加に失敗しました。');
        toast({
          title: "エラー",
          description: "画像の追加に失敗しました。",
          variant: "destructive",
        });
      }
    } else {
      console.log('ImageGenerationSection: No generated image to add');
      setError('追加する画像がありません。');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          投稿用画像生成
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">顔写真をアップロード</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFaceImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {faceImagePreview && (
              <img src={faceImagePreview} alt="Face preview" className="mt-2 w-20 h-20 object-cover rounded" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">画像の内容</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="例：美しい女性、スーツを着た男性"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">追加の説明（オプション）</label>
            <input
              type="text"
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="例：オフィスで、笑顔で"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <Button 
            onClick={handleGenerateForPosts}
            disabled={!faceImage || generating || isGenerating}
            className="w-full"
          >
            {generating || isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 mr-2" />
                画像を生成
              </>
            )}
          </Button>
        </div>

        {generatedImage && (
          <div className="space-y-3">
            <GeneratedImageDisplay
              generatedImage={generatedImage}
              onDownload={downloadImage}
            />
            <Button onClick={handleAddToPost} className="w-full" variant="outline">
              この画像を投稿に追加
            </Button>
          </div>
        )}

        {generatedImages.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">追加済み画像 ({generatedImages.length}件)</h4>
            <div className="grid grid-cols-2 gap-2">
              {generatedImages.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Generated ${index + 1}`}
                  className="w-full h-20 object-cover rounded border"
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
