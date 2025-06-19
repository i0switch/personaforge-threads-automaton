import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Image as ImageIcon, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ImageGenerator = () => {
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            AI画像生成
          </CardTitle>
          <CardDescription>
            顔画像とプロンプトから新しい画像を生成します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Face Image Upload */}
          <div className="space-y-2">
            <Label htmlFor="face-image">顔写真</Label>
            <div className="flex items-center gap-4">
              <Input
                id="face-image"
                type="file"
                accept="image/*"
                onChange={handleFaceImageChange}
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

          {/* Subject Description */}
          <div className="space-y-2">
            <Label htmlFor="subject">被写体説明</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="例: woman in black suit, smiling"
            />
          </div>

          {/* Additional Prompt */}
          <div className="space-y-2">
            <Label htmlFor="additional-prompt">追加プロンプト（任意）</Label>
            <Textarea
              id="additional-prompt"
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="例: outdoor, sunny day, professional photography"
              rows={3}
            />
          </div>

          {/* Additional Negative Prompt */}
          <div className="space-y-2">
            <Label htmlFor="additional-negative">追加ネガティブプロンプト（任意）</Label>
            <Textarea
              id="additional-negative"
              value={additionalNegative}
              onChange={(e) => setAdditionalNegative(e.target.value)}
              placeholder="例: glasses, hat, low quality"
              rows={2}
            />
          </div>

          {/* Advanced Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>CFG (Guidance Scale): {guidanceScale[0]}</Label>
              <Slider
                value={guidanceScale}
                onValueChange={setGuidanceScale}
                min={1}
                max={15}
                step={0.5}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>IP Adapter Scale: {ipAdapterScale[0]}</Label>
              <Slider
                value={ipAdapterScale}
                onValueChange={setIpAdapterScale}
                min={0}
                max={1.5}
                step={0.05}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>生成ステップ数 (Steps): {numSteps[0]}</Label>
              <Slider
                value={numSteps}
                onValueChange={setNumSteps}
                min={10}
                max={50}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>幅 (Width): {width[0]}px</Label>
              <Slider
                value={width}
                onValueChange={setWidth}
                min={512}
                max={1024}
                step={64}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>高さ (Height): {height[0]}px</Label>
              <Slider
                value={height}
                onValueChange={setHeight}
                min={512}
                max={1024}
                step={64}
                className="w-full"
              />
            </div>
          </div>

          {/* Upscale Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="upscale"
                checked={upscale}
                onCheckedChange={(checked) => setUpscale(checked === true)}
              />
              <Label htmlFor="upscale">アップスケール</Label>
            </div>
            
            {upscale && (
              <div className="space-y-2">
                <Label>アップスケール倍率: {upscaleFactor[0]}x</Label>
                <Slider
                  value={upscaleFactor}
                  onValueChange={setUpscaleFactor}
                  min={1}
                  max={8}
                  step={1}
                  className="w-full"
                />
              </div>
            )}
          </div>

          <Button
            onClick={generateImage}
            disabled={generating || !faceImage}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                画像生成中...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 mr-2" />
                画像を生成
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Image */}
      {generatedImage && (
        <Card>
          <CardHeader>
            <CardTitle>生成された画像</CardTitle>
            <CardDescription>
              生成が完了しました。ダウンロードして保存できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>
            <Button onClick={downloadImage} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              画像をダウンロード
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImageGenerator;