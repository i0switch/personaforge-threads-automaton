
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, X, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { authSecurity } from '@/utils/authSecurity';

interface SecurePasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStrengthIndicator?: boolean;
  onValidityChange?: (isValid: boolean) => void;
}

export const SecurePasswordInput: React.FC<SecurePasswordInputProps> = ({
  value,
  onChange,
  placeholder = "パスワードを入力",
  showStrengthIndicator = true,
  onValidityChange
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] }>({
    valid: false,
    errors: []
  });
  const [isChecking, setIsChecking] = useState(false);

  // パスワード強度の即座チェック
  useEffect(() => {
    if (!value || !showStrengthIndicator) {
      setValidation({ valid: false, errors: [] });
      onValidityChange?.(false);
      return;
    }

    const checkPasswordStrength = async () => {
      setIsChecking(true);
      try {
        const result = await authSecurity.validatePasswordStrength(value);
        setValidation(result);
        onValidityChange?.(result.valid);
      } catch (error) {
        console.error('Password validation error:', error);
        setValidation({ 
          valid: false, 
          errors: ['検証中にエラーが発生しました'] 
        });
        onValidityChange?.(false);
      } finally {
        setIsChecking(false);
      }
    };

    // デバウンス処理
    const timeoutId = setTimeout(checkPasswordStrength, 300);
    return () => clearTimeout(timeoutId);
  }, [value, showStrengthIndicator, onValidityChange]);

  const getStrengthColor = () => {
    if (!value) return 'bg-gray-200';
    if (isChecking) return 'bg-yellow-200';
    return validation.valid ? 'bg-green-500' : 'bg-red-500';
  };

  const getStrengthText = () => {
    if (!value) return '';
    if (isChecking) return '検証中...';
    return validation.valid ? '強力' : '弱い';
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
          autoComplete="new-password"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-gray-400" />
          ) : (
            <Eye className="h-4 w-4 text-gray-400" />
          )}
        </Button>
      </div>

      {showStrengthIndicator && value && (
        <div className="space-y-2">
          {/* 強度バー */}
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
                style={{ width: validation.valid ? '100%' : '30%' }}
              />
            </div>
            <span className="text-sm font-medium text-gray-600">
              {getStrengthText()}
            </span>
          </div>

          {/* 検証結果 */}
          {!isChecking && validation.errors.length > 0 && (
            <div className="space-y-1 text-sm">
              {validation.errors.map((error, index) => (
                <div key={index} className="flex items-center space-x-2 text-red-600">
                  <X className="h-3 w-3" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          {!isChecking && validation.valid && (
            <div className="flex items-center space-x-2 text-green-600 text-sm">
              <Check className="h-3 w-3" />
              <span>パスワードの強度は十分です</span>
            </div>
          )}

          {isChecking && (
            <div className="flex items-center space-x-2 text-yellow-600 text-sm">
              <AlertTriangle className="h-3 w-3 animate-spin" />
              <span>パスワード強度を確認中...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
