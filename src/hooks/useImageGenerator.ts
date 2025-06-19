import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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

          const formData = new FormData();
          formData.append('face_image', imageData);
          formData.append('subject', subject);
          formData.append('additional_prompt', additionalPrompt);
          formData.append('additional_negative', additionalNegative);
          formData.append('guidance_scale', guidanceScale[0].toString());
          formData.append('ip_adapter_scale', ipAdapterScale[0].toString());
          formData.append('steps', numSteps[0].toString());
          formData.append('width', width[0].toString());
          formData.append('height', height[0].toString());
          formData.append('upscale', upscale.toString());
          formData.append('upscale_factor', upscaleFactor[0].toString());

          // Call the backend app directly (assuming it's running on a specific URL)
          // You may need to adjust this URL based on your setup
          const response = await fetch('/api/predict', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('画像生成に失敗しました');
          }

          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setGeneratedImage(imageUrl);

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
    link.download = `generated-image-${Date.now()}.png`;
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
};