import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ImageGenerator from "@/components/ImageGenerator";

const ImageGeneration = () => {
  const navigate = useNavigate();

  const downloadHookCode = () => {
    const hookCode = `import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface ImageGeneratorState {
  faceImage: File | null;
  faceImagePreview: string;
  subject: string;
  additionalPrompt: string;
  additionalNegative: string;
  guidanceScale: number[];
  ipAdapterScale: number[];
  numSteps: number[];
  width: number[];
  height: number[];
  upscale: boolean;
  upscaleFactor: number[];
  generating: boolean;
  generatedImage: string;
}

export const useImageGenerator = () => {
  const { toast } = useToast();
  
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [faceImagePreview, setFaceImagePreview] = useState<string>("");
  const [subject, setSubject] = useState("a beautiful 20yo woman");
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [additionalNegative, setAdditionalNegative] = useState("");
  const [guidanceScale, setGuidanceScale] = useState([6.0]);
  const [ipAdapterScale, setIpAdapterScale] = useState([0.65]);
  const [numSteps, setNumSteps] = useState([20]);
  const [width, setWidth] = useState([512]);
  const [height, setHeight] = useState([768]);
  const [upscale, setUpscale] = useState(true);
  const [upscaleFactor, setUpscaleFactor] = useState([2]);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>("");

  const handleFaceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaceImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFaceImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImage = async () => {
    if (!faceImage) {
      toast({
        title: "エラー",
        description: "顔写真をアップロードしてください。",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const imageData = base64.split(',')[1]; // Remove data:image/...;base64, prefix

          const payload = {
            face_image_b64: imageData,
            prompt: subject + (additionalPrompt ? \`, \${additionalPrompt}\` : ''),
            negative_prompt: additionalNegative,
            guidance_scale: guidanceScale[0],
            ip_adapter_scale: ipAdapterScale[0],
            num_inference_steps: numSteps[0],
            width: width[0],
            height: height[0],
            upscale: upscale,
            upscale_factor: upscaleFactor[0]
          };

          console.log('Calling edge function with payload:', payload);

          const { data, error } = await supabase.functions.invoke('generate-image-huggingface', {
            body: payload
          });

          if (error) {
            console.error('Edge function error:', error);
            throw new Error(\`画像生成に失敗しました: \${error.message}\`);
          }

          if (!data || !data.image) {
            throw new Error('画像データが返されませんでした');
          }

          setGeneratedImage(data.image);

          toast({
            title: "生成完了",
            description: "画像が正常に生成されました。",
          });
        } catch (error) {
          console.error('Error generating image:', error);
          toast({
            title: "エラー",
            description: error.message || "画像生成に失敗しました。",
            variant: "destructive",
          });
        } finally {
          setGenerating(false);
        }
      };
      reader.readAsDataURL(faceImage);
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "エラー",
        description: "画像生成に失敗しました。",
        variant: "destructive",
      });
      setGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = \`generated-image-\${Date.now()}.png\`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    // State
    faceImage,
    faceImagePreview,
    subject,
    additionalPrompt,
    additionalNegative,
    guidanceScale,
    ipAdapterScale,
    numSteps,
    width,
    height,
    upscale,
    upscaleFactor,
    generating,
    generatedImage,
    
    // Setters
    setSubject,
    setAdditionalPrompt,
    setAdditionalNegative,
    setGuidanceScale,
    setIpAdapterScale,
    setNumSteps,
    setWidth,
    setHeight,
    setUpscale,
    setUpscaleFactor,
    
    // Actions
    handleFaceImageChange,
    generateImage,
    downloadImage,
  };
};`;

    const blob = new Blob([hookCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'useImageGenerator.ts';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate("/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">AI画像生成</h1>
            <p className="text-muted-foreground">顔画像からAIで新しい画像を生成</p>
          </div>
          <Button onClick={downloadHookCode} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Hook コードをダウンロード
          </Button>
        </div>

        <ImageGenerator />
      </div>
    </div>
  );
};

export default ImageGeneration;