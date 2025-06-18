import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ImageGenerator from "@/components/ImageGenerator";

const ImageGeneration = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate("/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI画像生成</h1>
            <p className="text-muted-foreground">顔画像からAIで新しい画像を生成</p>
          </div>
        </div>

        <ImageGenerator />
      </div>
    </div>
  );
};

export default ImageGeneration;