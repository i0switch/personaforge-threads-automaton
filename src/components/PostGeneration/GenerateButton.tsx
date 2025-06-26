
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Zap } from 'lucide-react';

interface GenerateButtonProps {
  onGenerate: () => void;
  canGenerate: boolean;
  loading: boolean;
  selectedDates: string[];
  selectedTimes: string[];
}

export const GenerateButton = ({ 
  onGenerate, 
  canGenerate, 
  loading, 
  selectedDates, 
  selectedTimes 
}: GenerateButtonProps) => {
  const totalPosts = selectedDates.length * selectedTimes.length;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          {canGenerate && (
            <p className="text-sm text-muted-foreground">
              {totalPosts}件の投稿を生成します
            </p>
          )}
          <Button 
            onClick={onGenerate} 
            disabled={!canGenerate || loading}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                投稿を生成
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
