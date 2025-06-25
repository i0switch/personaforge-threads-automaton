
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

const DEFAULT_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 
  'password123', 'admin', 'letmein', 'welcome', 'monkey'
];

export const validatePassword = (
  password: string, 
  requirements: PasswordRequirements = DEFAULT_REQUIREMENTS
): PasswordValidationResult => {
  const errors: string[] = [];
  let strengthScore = 0;

  // Length check
  if (password.length < requirements.minLength) {
    errors.push(`パスワードは${requirements.minLength}文字以上である必要があります`);
  } else {
    strengthScore += 1;
  }

  // Uppercase check
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('大文字を含む必要があります');
  } else if (/[A-Z]/.test(password)) {
    strengthScore += 1;
  }

  // Lowercase check
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('小文字を含む必要があります');
  } else if (/[a-z]/.test(password)) {
    strengthScore += 1;
  }

  // Numbers check
  if (requirements.requireNumbers && !/\d/.test(password)) {
    errors.push('数字を含む必要があります');
  } else if (/\d/.test(password)) {
    strengthScore += 1;
  }

  // Special characters check
  if (requirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('特殊文字(!@#$%^&*など)を含む必要があります');
  } else if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    strengthScore += 1;
  }

  // Common password check
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('一般的すぎるパスワードです');
    strengthScore = Math.max(0, strengthScore - 2);
  }

  // Additional length bonus
  if (password.length >= 12) {
    strengthScore += 1;
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong';
  if (strengthScore <= 2) {
    strength = 'weak';
  } else if (strengthScore <= 4) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
};
