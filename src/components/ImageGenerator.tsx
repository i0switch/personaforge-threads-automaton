import { Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useImageGenerator } from "@/hooks/useImageGenerator";
import { FaceImageUpload } from "./ImageGenerator/FaceImageUpload";
import { PromptSettings } from "./ImageGenerator/PromptSettings";
import { AdvancedSettings } from "./ImageGenerator/AdvancedSettings";
import { GenerateButton } from "./ImageGenerator/GenerateButton";
import { GeneratedImageDisplay } from "./ImageGenerator/GeneratedImageDisplay";

const ImageGenerator = () => {
  const {
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
    handleFaceImageChange,
    generateImage,
    downloadImage,
  } = useImageGenerator();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="animate-fade-in">
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
          <FaceImageUpload
            faceImagePreview={faceImagePreview}
            onImageChange={handleFaceImageChange}
          />

          <PromptSettings
            subject={subject}
            additionalPrompt={additionalPrompt}
            additionalNegative={additionalNegative}
            onSubjectChange={setSubject}
            onAdditionalPromptChange={setAdditionalPrompt}
            onAdditionalNegativeChange={setAdditionalNegative}
          />

          <AdvancedSettings
            guidanceScale={guidanceScale}
            ipAdapterScale={ipAdapterScale}
            numSteps={numSteps}
            width={width}
            height={height}
            upscale={upscale}
            upscaleFactor={upscaleFactor}
            onGuidanceScaleChange={setGuidanceScale}
            onIpAdapterScaleChange={setIpAdapterScale}
            onNumStepsChange={setNumSteps}
            onWidthChange={setWidth}
            onHeightChange={setHeight}
            onUpscaleChange={setUpscale}
            onUpscaleFactorChange={setUpscaleFactor}
          />

          <GenerateButton
            generating={generating}
            disabled={generating || !faceImage}
            onClick={generateImage}
          />
        </CardContent>
      </Card>

      <GeneratedImageDisplay
        generatedImage={generatedImage}
        onDownload={downloadImage}
      />
    </div>
  );
};

export default ImageGenerator;