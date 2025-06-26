
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface CustomPromptInputProps {
  customPrompt: string;
  onCustomPromptChange: (prompt: string) => void;
}

export const CustomPromptInput = ({ customPrompt, onCustomPromptChange }: CustomPromptInputProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>カスタムプロンプト（オプション）</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="投稿生成時の追加指示があれば入力してください..."
          className="min-h-[100px]"
        />
      </CardContent>
    </Card>
  );
};
