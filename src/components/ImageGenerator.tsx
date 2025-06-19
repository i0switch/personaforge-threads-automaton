import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ImageGenerator = () => {
  const { toast } = useToast();
  
  const [useAlternativeAPI, setUseAlternativeAPI] = useState(false);
  const [spaceUrl, setSpaceUrl] = useState("https://huggingface.co/spaces/multimodalart/face-to-all");
  const [personaId, setPersonaId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [guidanceScale, setGuidanceScale] = useState([8.0]);
  const [ipAdapterScale, setIpAdapterScale] = useState([0.6]);
  const [numSteps, setNumSteps] = useState([25]);
  const [width, setWidth] = useState([512]);
  const [height, setHeight] = useState([768]);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>("");

  const generateImage = async () => {
    if (!prompt || (!useAlternativeAPI && !personaId)) {
      toast({
        title: "エラー",
        description: useAlternativeAPI ? "プロンプトを入力してください。" : "ペルソナIDとプロンプトを入力してください。",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      if (useAlternativeAPI) {
        // Use stable HuggingFace Inference API
        const { data, error } = await supabase.functions.invoke('generate-image-huggingface-alternative', {
          body: {
            prompt: prompt,
            persona_id: personaId || null
          }
        });

        if (error) throw error;

        if (data.success && data.image) {
          setGeneratedImage(`data:image/png;base64,${data.image}`);
          toast({
            title: "生成完了",
            description: "画像が正常に生成されました。",
          });
        } else {
          throw new Error(data.error || "画像生成に失敗しました");
        }
      } else {
        // Use custom Gradio Space API
        const { data, error } = await supabase.functions.invoke('generate-image-stable-diffusion', {
          body: {
            api_url: spaceUrl,
            persona_id: personaId,
            prompt: prompt,
            negative_prompt: negativePrompt,
            guidance_scale: guidanceScale[0],
            ip_adapter_scale: ipAdapterScale[0],
            num_inference_steps: numSteps[0],
            width: width[0],
            height: height[0]
          }
        });

        if (error) throw error;

        if (data.success && data.image) {
          setGeneratedImage(`data:image/png;base64,${data.image}`);
          toast({
            title: "生成完了",
            description: "画像が正常に生成されました。",
          });
        } else {
          throw new Error(data.error || "画像生成に失敗しました");
        }
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
          {/* API Selection */}
          <div className="flex items-center space-x-2">
            <Switch
              id="use-alternative"
              checked={useAlternativeAPI}
              onCheckedChange={setUseAlternativeAPI}
            />
            <Label htmlFor="use-alternative">
              安定版HuggingFace APIを使用 (推奨)
            </Label>
          </div>
          
          {!useAlternativeAPI && (
            <div className="space-y-2">
              <Label htmlFor="space-url">HuggingFace Space URL</Label>
              <Input
                id="space-url"
                value={spaceUrl}
                onChange={(e) => setSpaceUrl(e.target.value)}
                placeholder="https://huggingface.co/spaces/username/space-name"
              />
            </div>
          )}

          {/* Persona ID */}
          <div className="space-y-2">
            <Label htmlFor="persona-id">ペルソナID</Label>
            <Input
              id="persona-id"
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              placeholder="ペルソナIDを入力してください"
            />
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

          {/* Advanced Settings - only show when not using alternative API */}
          {!useAlternativeAPI && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

              <div className="space-y-2">
                <Label>幅 (Width): {width[0]}px</Label>
                <Slider
                  value={width}
                  onValueChange={setWidth}
                  min={256}
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
                  min={256}
                  max={1024}
                  step={64}
                  className="w-full"
                />
              </div>
            </div>
          )}

          <Button
            onClick={generateImage}
            disabled={generating || !prompt || (!useAlternativeAPI && !personaId)}
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