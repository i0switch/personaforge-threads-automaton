import { Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateButtonProps {
  generating: boolean;
  disabled: boolean;
  onClick: () => void;
}

export const GenerateButton = ({ generating, disabled, onClick }: GenerateButtonProps) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="w-full hover-scale"
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
  );
};