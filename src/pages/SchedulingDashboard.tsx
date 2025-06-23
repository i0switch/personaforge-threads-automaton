
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SchedulingSettings } from "@/components/Scheduling/SchedulingSettings";
import { PostQueue } from "@/components/Scheduling/PostQueue";
import { AutoScheduler } from "@/components/Scheduling/AutoScheduler";

const SchedulingDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">スケジ ューリング管理</h1>
            <p className="text-muted-foreground">
              自動投稿・キュー管理・リトライ設定
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <SchedulingSettings />
            <AutoScheduler />
          </div>
          <div>
            <PostQueue />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulingDashboard;
