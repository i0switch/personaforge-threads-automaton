
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Users, ShoppingCart } from "lucide-react";

interface PersonaLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
  limit: number;
}

export const PersonaLimitDialog = ({ open, onOpenChange, currentCount, limit }: PersonaLimitDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            ペルソナ上限に達しました
          </DialogTitle>
          <DialogDescription>
            新しいペルソナを作成するには、プランをアップグレードしてください。
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                現在の利用状況
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="text-3xl font-bold text-primary mb-2">
                  {currentCount} / {limit}
                </div>
                <p className="text-muted-foreground">
                  作成済みペルソナ数
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                プラン追加購入
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                追加のペルソナを作成するには、管理者にお問い合わせください。
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>現在のプラン:</span>
                  <span className="font-medium">{limit}ペルソナまで</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>追加プラン:</span>
                  <span className="font-medium text-primary">お問い合わせ</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              キャンセル
            </Button>
            <Button 
              onClick={() => {
                // 実際の購入フローはここに実装
                window.open('mailto:support@example.com?subject=ペルソナプラン追加購入について', '_blank');
              }}
              className="flex-1"
            >
              お問い合わせ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
