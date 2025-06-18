import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload, Download, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ImageGenerator = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [spaceUrl, setSpaceUrl] = useState("https://huggingface.co/spaces/multimodalart/face-to-all");
  const [faceImage, setFaceImage] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [guidanceScale, setGuidanceScale] = useState([8.0]);
  const [ipAdapterScale, setIpAdapterScale] = useState([0.6]);
  const [numSteps, setNumSteps] = useState([25]);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "エラー",
        description: "画像ファイルを選択してください。",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        // Remove data URL prefix to get pure base64
        const base64Data = base64.split(',')[1];
        setFaceImage(base64Data);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: "エラー",
        description: "ファイルの読み込みに失敗しました。",
        variant: "destructive",
      });
      setUploading(false);
    }
  };

  const generateImage = async () => {
    if (!faceImage || !prompt) {
      toast({
        title: "エラー",
        description: "顔画像とプロンプトを入力してください。",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image-huggingface', {
        body: {
          space_url: spaceUrl,
          face_image: faceImage,
          prompt: prompt,
          negative_prompt: negativePrompt,
          guidance_scale: guidanceScale[0],
          ip_adapter_scale: ipAdapterScale[0],
          num_steps: numSteps[0]
        }
      });

      if (error) throw error;

      if (data.success && data.image_data) {
        setGeneratedImage(`data:image/png;base64,${data.image_data}`);
        toast({
          title: "生成完了",
          description: "画像が正常に生成されました。",
        });
      } else {
        throw new Error(data.error || "画像生成に失敗しました");
      }
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
          {/* Space URL */}
          <div className="space-y-2">
            <Label htmlFor="space-url">HuggingFace Space URL</Label>
            <Input
              id="space-url"
              value={spaceUrl}
              onChange={(e) => setSpaceUrl(e.target.value)}
              placeholder="https://huggingface.co/spaces/username/space-name"
            />
          </div>

          {/* Face Image Upload */}
          <div className="space-y-2">
            <Label>顔画像</Label>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    アップロード中...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    画像を選択
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              {faceImage && (
                <span className="text-sm text-muted-foreground">
                  画像がアップロードされました
                </span>
              )}
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">プロンプト</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例: 1girl, a photo of a cute girl in a suit, smile"
              rows={3}
            />
          </div>

          {/* Negative Prompt */}
          <div className="space-y-2">
            <Label htmlFor="negative-prompt">ネガティブプロンプト（任意）</Label>
            <Textarea
              id="negative-prompt"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="例: glasses, hat"
              rows={2}
            />
          </div>

          {/* Advanced Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>プロンプトへの忠実度 (Guidance Scale): {guidanceScale[0]}</Label>
              <Slider
                value={guidanceScale}
                onValueChange={setGuidanceScale}
                min={1}
                max={20}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>顔の忠実度 (IP Adapter Scale): {ipAdapterScale[0]}</Label>
              <Slider
                value={ipAdapterScale}
                onValueChange={setIpAdapterScale}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>生成ステップ数 (Steps): {numSteps[0]}</Label>
              <Slider
                value={numSteps}
                onValueChange={setNumSteps}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <Button
            onClick={generateImage}
            disabled={generating || !faceImage || !prompt}
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
                className="w-full max-w-2xl h-auto rounded-lg shadow-lg"
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