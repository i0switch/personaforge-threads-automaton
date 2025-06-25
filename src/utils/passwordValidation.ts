
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  prohibitCommon: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
  score: number;
}

const DEFAULT_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  prohibitCommon: true,
};

const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 
  'password123', 'admin', 'letmein', 'welcome', 'monkey',
  '1234567890', 'dragon', 'pass', 'master', 'hello',
  'freedom', 'whatever', 'qazwsx', 'trustno1', 'jordan'
];

const WEAK_PATTERNS = [
  /^(.)\1+$/, // 同じ文字の繰り返し
  /^123/, // 連続した数字
  /^abc/i, // 連続したアルファベット
  /keyboard|qwerty|asdf/i, // キーボード配列
];

export const validatePassword = (
  password: string, 
  requirements: PasswordRequirements = DEFAULT_REQUIREMENTS
): PasswordValidationResult => {
  const errors: string[] = [];
  let score = 0;

  // 長さチェック
  if (password.length < requirements.minLength) {
    errors.push(`パスワードは${requirements.minLength}文字以上である必要があります`);
  } else {
    score += Math.min(password.length * 4, 25);
  }

  // 大文字チェック
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('大文字を含む必要があります');
  } else if (/[A-Z]/.test(password)) {
    score += 5;
  }

  // 小文字チェック
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('小文字を含む必要があります');
  } else if (/[a-z]/.test(password)) {
    score += 5;
  }

  // 数字チェック
  if (requirements.requireNumbers && !/\d/.test(password)) {
    errors.push('数字を含む必要があります');
  } else if (/\d/.test(password)) {
    score += 5;
  }

  // 特殊文字チェック
  if (requirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('特殊文字(!@#$%^&*など)を含む必要があります');
  } else if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 10;
  }

  // 一般的なパスワードチェック
  if (requirements.prohibitCommon && COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('一般的すぎるパスワードです');
    score = Math.max(0, score - 50);
  }

  // 弱いパターンチェック
  for (const pattern of WEAK_PATTERNS) {
    if (pattern.test(password)) {
      errors.push('予測しやすいパターンが含まれています');
      score = Math.max(0, score - 20);
      break;
    }
  }

  // 多様性ボーナス
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.8) {
    score += 10;
  }

  // 長さボーナス
  if (password.length >= 12) {
    score += 10;
  }
  if (password.length >= 16) {
    score += 10;
  }

  // 強度判定
  let strength: 'weak' | 'medium' | 'strong';
  if (score < 30) {
    strength = 'weak';
  } else if (score < 60) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    score: Math.min(score, 100)
  };
};

export const generatePasswordSuggestion = (): string => {
  const adjectives = ['Strong', 'Secure', 'Safe', 'Smart', 'Quick'];
  const nouns = ['Tiger', 'Eagle', 'Dragon', 'Phoenix', 'Wolf'];
  const symbols = ['!', '@', '#', '$', '%'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 100);
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  return `${adjective}${noun}${number}${symbol}`;
};
