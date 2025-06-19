import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-4">ページが見つかりません</p>
        <p className="text-sm text-muted-foreground mb-6">
          お探しのページは存在しないか、移動された可能性があります。
        </p>
        <Button onClick={() => window.location.href = "/"} variant="outline">
          ホームに戻る
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
