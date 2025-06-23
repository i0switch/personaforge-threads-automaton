
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";

interface BulkActionsProps {
  selectedPosts: string[];
  bulkDeleting: boolean;
  onBulkDelete: () => void;
}

export const BulkActions = ({ selectedPosts, bulkDeleting, onBulkDelete }: BulkActionsProps) => {
  if (selectedPosts.length === 0) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={bulkDeleting}>
          {bulkDeleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              削除中...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              選択した{selectedPosts.length}件を削除
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>投稿の一括削除</AlertDialogTitle>
          <AlertDialogDescription>
            選択した{selectedPosts.length}件の投稿を削除しますか？この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
