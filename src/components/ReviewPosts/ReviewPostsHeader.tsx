
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const ReviewPostsHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-4">
      <Button variant="outline" size="sm" onClick={() => navigate("/create-posts")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        戻る
      </Button>
      <div className="flex-1">
        <h1 className="text-3xl font-bold">生成投稿確認</h1>
        <p className="text-muted-foreground">生成された投稿を確認・修正してください</p>
      </div>
    </div>
  );
};
