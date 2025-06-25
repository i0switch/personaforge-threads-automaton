
import { validatePassword, type PasswordValidationResult } from "@/utils/passwordValidation";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export const PasswordStrengthIndicator = ({ password, className }: PasswordStrengthIndicatorProps) => {
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

  return (
    <div className={cn("mt-2", className)}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-muted-foreground">パスワード強度:</span>
        <span className={cn(
          "text-xs font-medium",
          validation.strength === 'weak' && "text-red-600",
          validation.strength === 'medium' && "text-yellow-600", 
          validation.strength === 'strong' && "text-green-600"
        )}>
          {strengthText[validation.strength]}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div 
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            strengthColors[validation.strength]
          )}
          style={{ 
            width: validation.strength === 'weak' ? '33%' : 
                   validation.strength === 'medium' ? '66%' : '100%' 
          }}
        ></div>
      </div>

      {validation.errors.length > 0 && (
        <ul className="mt-1 text-xs text-red-600 space-y-0.5">
          {validation.errors.map((error, index) => (
            <li key={index}>• {error}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
