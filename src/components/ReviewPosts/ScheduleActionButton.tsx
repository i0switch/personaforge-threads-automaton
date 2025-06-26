
import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";

interface ScheduleActionButtonProps {
  onSchedule: () => void;
  isScheduling: boolean;
  postCount: number;
}

export const ScheduleActionButton = ({ onSchedule, isScheduling, postCount }: ScheduleActionButtonProps) => {
  return (
    <div className="flex gap-4">
      <Button 
        onClick={onSchedule} 
        disabled={isScheduling || postCount === 0}
        className="flex-1"
        size="lg"
      >
        {isScheduling ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            予約中...
          </>
        ) : (
          <>
            <Calendar className="h-4 w-4 mr-2" />
            投稿を予約する
          </>
        )}
      </Button>
    </div>
  );
};
