
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface TopicInputProps {
  topics: string[];
  onTopicsChange: (topics: string[]) => void;
}

export const TopicInput = ({ topics, onTopicsChange }: TopicInputProps) => {
  const [inputValue, setInputValue] = useState('');

  const addTopic = () => {
    if (inputValue.trim() && !topics.includes(inputValue.trim())) {
      onTopicsChange([...topics, inputValue.trim()]);
      setInputValue('');
    }
  };

  const removeTopic = (topicToRemove: string) => {
    onTopicsChange(topics.filter(topic => topic !== topicToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTopic();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>投稿トピック</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="トピックを入力..."
          />
          <Button onClick={addTopic} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              {topic}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTopic(topic)}
                className="h-4 w-4 p-0 hover:bg-transparent"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
