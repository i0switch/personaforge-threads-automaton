
import { containsSqlInjection, sanitizeInput } from '@/lib/validation';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: string;
}

export const inputValidation = {
  // 一般的なテキスト入力の検証
  validateText: (value: string, options: {
    maxLength?: number;
    minLength?: number;
    required?: boolean;
    allowSpecialChars?: boolean;
  } = {}): ValidationResult => {
    const errors: string[] = [];
    
    if (options.required && (!value || value.trim().length === 0)) {
      errors.push('この項目は必須です');
      return { isValid: false, errors };
    }

    if (!value) {
      return { isValid: true, errors: [], sanitizedValue: '' };
    }

    if (options.minLength && value.length < options.minLength) {
      errors.push(`${options.minLength}文字以上で入力してください`);
    }

    if (options.maxLength && value.length > options.maxLength) {
      errors.push(`${options.maxLength}文字以下で入力してください`);
    }

    // SQLインジェクション検査
    if (containsSqlInjection(value)) {
      errors.push('使用できない文字が含まれています');
    }

    // 危険な文字の検査
    if (!options.allowSpecialChars) {
      const dangerousChars = /<script|javascript:|data:/i;
      if (dangerousChars.test(value)) {
        errors.push('使用できない文字が含まれています');
      }
    }

    const sanitizedValue = sanitizeInput(value);
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  },

  // メールアドレスの検証
  validateEmail: (email: string): ValidationResult => {
    const errors: string[] = [];
    
    if (!email || email.trim().length === 0) {
      errors.push('メールアドレスは必須です');
      return { isValid: false, errors };
    }

    // 基本的なメール形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('有効なメールアドレスを入力してください');
    }

    // 長さチェック
    if (email.length > 254) {
      errors.push('メールアドレスが長すぎます');
    }

    // 危険な文字の検査
    if (containsSqlInjection(email)) {
      errors.push('使用できない文字が含まれています');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: email.trim().toLowerCase()
    };
  },

  // URL の検証
  validateUrl: (url: string, options: { required?: boolean } = {}): ValidationResult => {
    const errors: string[] = [];
    
    if (options.required && (!url || url.trim().length === 0)) {
      errors.push('URLは必須です');
      return { isValid: false, errors };
    }

    if (!url || url.trim().length === 0) {
      return { isValid: true, errors: [], sanitizedValue: '' };
    }

    try {
      const urlObj = new URL(url);
      
      // プロトコルチェック
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push('HTTPまたはHTTPSのURLを入力してください');
      }
      
      // 危険なスキームの検査
      const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
      if (dangerousProtocols.some(protocol => url.toLowerCase().startsWith(protocol))) {
        errors.push('使用できないURLです');
      }
      
    } catch (error) {
      errors.push('有効なURLを入力してください');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: url.trim()
    };
  },

  // ペルソナ名の検証
  validatePersonaName: (name: string): ValidationResult => {
    return inputValidation.validateText(name, {
      required: true,
      minLength: 1,
      maxLength: 50,
      allowSpecialChars: false
    });
  },

  // ペルソナの説明文の検証
  validatePersonaDescription: (description: string): ValidationResult => {
    return inputValidation.validateText(description, {
      required: false,
      maxLength: 500,
      allowSpecialChars: false
    });
  },

  // 投稿コンテンツの検証
  validatePostContent: (content: string): ValidationResult => {
    return inputValidation.validateText(content, {
      required: true,
      minLength: 1,
      maxLength: 2000,
      allowSpecialChars: true // 投稿では絵文字等を許可
    });
  },

  // APIキー名の検証
  validateApiKeyName: (keyName: string): ValidationResult => {
    const errors: string[] = [];
    
    if (!keyName || keyName.trim().length === 0) {
      errors.push('APIキー名は必須です');
      return { isValid: false, errors };
    }

    // 英数字とアンダースコアのみ許可
    const validPattern = /^[A-Z0-9_]+$/;
    if (!validPattern.test(keyName)) {
      errors.push('APIキー名は大文字英数字とアンダースコアのみ使用できます');
    }

    if (keyName.length > 50) {
      errors.push('APIキー名は50文字以下で入力してください');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: keyName.trim().toUpperCase()
    };
  }
};
