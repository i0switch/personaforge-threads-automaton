
import { validatePassword, type PasswordValidationResult } from "@/utils/passwordValidation";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
  showSuggestions?: boolean;
}

export const PasswordStrengthIndicator = ({ 
  password, 
  className,
  showSuggestions = true 
}: PasswordStrengthIndicatorProps) => {
  const validation: PasswordValidationResult = validatePassword(password);

  if (!password) return null;

  const strengthColors = {
    weak: "bg-red-500",
    medium: "bg-yellow-500", 
    strong: "bg-green-500"
  };

  const strengthText = {
    weak: "弱い",
    medium: "普通",
    strong: "強い"
  };

  const getProgressColor = () => {
    switch (validation.strength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">パスワード強度:</span>
        <span className={cn(
          "text-xs font-medium",
          validation.strength === 'weak' && "text-red-600",
          validation.strength === 'medium' && "text-yellow-600", 
          validation.strength === 'strong' && "text-green-600"
        )}>
          {strengthText[validation.strength]} ({validation.score}/100)
        </span>
      </div>
      
      <div className="relative">
        <Progress 
          value={validation.score} 
          className="h-2"
        />
        <div 
          className={cn(
            "absolute top-0 left-0 h-2 rounded-full transition-all duration-300",
            getProgressColor()
          )}
          style={{ width: `${validation.score}%` }}
        />
      </div>

      {validation.errors.length > 0 && (
        <ul className="text-xs text-red-600 space-y-0.5">
          {validation.errors.map((error, index) => (
            <li key={index} className="flex items-start gap-1">
              <span className="text-red-500 mt-0.5">•</span>
              <span>{error}</span>
            </li>
          ))}
        </ul>
      )}

      {showSuggestions && validation.strength !== 'strong' && (
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
          <strong>改善提案:</strong>
          <ul className="mt-1 space-y-0.5">
            {password.length < 12 && (
              <li>• より長いパスワード（12文字以上推奨）</li>
            )}
            {!/[A-Z]/.test(password) && (
              <li>• 大文字を追加</li>
            )}
            {!/[!@#$%^&*(),.?":{}|<>]/.test(password) && (
              <li>• 特殊文字を追加</li>
            )}
            {validation.score < 40 && (
              <li>• より複雑な組み合わせを使用</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
