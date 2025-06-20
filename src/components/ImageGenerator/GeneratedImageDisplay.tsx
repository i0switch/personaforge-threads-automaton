import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface GeneratedImageDisplayProps {
  generatedImage: string;
  onDownload: () => void;
}

export const GeneratedImageDisplay = ({ generatedImage, onDownload }: GeneratedImageDisplayProps) => {
  if (!generatedImage) return null;

  return (
    <Card className="animate-fade-in">
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
            className="w-full h-auto rounded-lg shadow-lg animate-scale-in"
          />
        </div>
        <Button onClick={onDownload} variant="outline" className="w-full hover-scale">
          <Download className="h-4 w-4 mr-2" />
          画像をダウンロード
        </Button>
      </CardContent>
    </Card>
  );
};