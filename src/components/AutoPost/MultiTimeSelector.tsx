import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MultiTimeSelectorProps {
  times: string[];
  onChange: (times: string[]) => void;
  disabled?: boolean;
}

export const MultiTimeSelector: React.FC<MultiTimeSelectorProps> = ({
  times,
  onChange,
  disabled = false
}) => {
  const [newTime, setNewTime] = useState('');

  const addTime = () => {
    if (!newTime) {
      toast({
        title: 'エラー',
        description: '時間を入力してください',
        variant: 'destructive'
      });
      return;
    }

    // 時間の妥当性チェック
    const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newTime)) {
      toast({
        title: 'エラー',
        description: '正しい時間形式（HH:MM）で入力してください',
        variant: 'destructive'
      });
      return;
    }

    // 重複チェック
    if (times.includes(newTime)) {
      toast({
        title: 'エラー',
        description: 'その時間は既に設定されています',
        variant: 'destructive'
      });
      return;
    }

    // 最大10個までの制限
    if (times.length >= 10) {
      toast({
        title: 'エラー',
        description: '投稿時間は最大10個まで設定できます',
        variant: 'destructive'
      });
      return;
    }

    const updatedTimes = [...times, newTime].sort();
    onChange(updatedTimes);
    setNewTime('');
    
    toast({
      title: '追加完了',
      description: `${newTime} を投稿時間に追加しました`
    });
  };

  const removeTime = (timeToRemove: string) => {
    const updatedTimes = times.filter(time => time !== timeToRemove);
    onChange(updatedTimes);
    
    toast({
      title: '削除完了',
      description: `${timeToRemove} を投稿時間から削除しました`
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTime();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="multi-times">投稿時間設定（複数）</Label>
        <p className="text-sm text-muted-foreground mb-2">
          複数の時間を設定すると、毎日これらの時間に自動投稿が実行されます
        </p>
      </div>

      {/* 現在設定されている時間一覧 */}
      {times.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">設定済み投稿時間</Label>
          <div className="flex flex-wrap gap-2">
            {times.map((time, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 px-3 py-1"
              >
                <span className="font-mono">{time}</span>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 w-4 h-4 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeTime(time)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 新しい時間を追加 */}
      {!disabled && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="HH:MM"
              className="font-mono"
            />
          </div>
          <Button
            type="button"
            onClick={addTime}
            disabled={!newTime || times.length >= 10}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        </div>
      )}

      {times.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          まだ投稿時間が設定されていません
        </div>
      )}

      {times.length >= 10 && (
        <p className="text-sm text-amber-600">
          ⚠️ 投稿時間の上限（10個）に達しました
        </p>
      )}
    </div>
  );
};