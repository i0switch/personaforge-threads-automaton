import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PromptSettingsProps {
  subject: string;
  additionalPrompt: string;
  additionalNegative: string;
  onSubjectChange: (value: string) => void;
  onAdditionalPromptChange: (value: string) => void;
  onAdditionalNegativeChange: (value: string) => void;
}

export const PromptSettings = ({
  subject,
  additionalPrompt,
  additionalNegative,
  onSubjectChange,
  onAdditionalPromptChange,
  onAdditionalNegativeChange,
}: PromptSettingsProps) => {
  return (
    <>
      {/* Subject Description */}
      <div className="space-y-2">
        <Label htmlFor="subject">被写体説明</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="例: woman in black suit, smiling"
        />
      </div>

      {/* Additional Prompt */}
      <div className="space-y-2">
        <Label htmlFor="additional-prompt">追加プロンプト（任意）</Label>
        <Textarea
          id="additional-prompt"
          value={additionalPrompt}
          onChange={(e) => onAdditionalPromptChange(e.target.value)}
          placeholder="例: outdoor, sunny day, professional photography"
          rows={3}
        />
      </div>

      {/* Additional Negative Prompt */}
      <div className="space-y-2">
        <Label htmlFor="additional-negative">追加ネガティブプロンプト（任意）</Label>
        <Textarea
          id="additional-negative"
          value={additionalNegative}
          onChange={(e) => onAdditionalNegativeChange(e.target.value)}
          placeholder="例: glasses, hat, low quality"
          rows={2}
        />
      </div>
    </>
  );
};