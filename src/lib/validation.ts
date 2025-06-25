
import { z } from 'zod';

// 共通の検証スキーマ
export const personaSchema = z.object({
  name: z.string()
    .min(1, '名前は必須です')
    .max(50, '名前は50文字以内で入力してください')
    .regex(/^[a-zA-Z0-9_\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/, '無効な文字が含まれています'),
  age: z.string()
    .max(10, '年齢は10文字以内で入力してください')
    .optional(),
  personality: z.string()
    .max(500, 'パーソナリティは500文字以内で入力してください')
    .optional(),
  expertise: z.array(z.string().max(50, '専門分野は50文字以内で入力してください'))
    .max(10, '専門分野は10個まで設定できます')
    .optional(),
  tone_of_voice: z.string()
    .max(200, '口調は200文字以内で入力してください')
    .optional(),
});

export const postSchema = z.object({
  content: z.string()
    .min(1, '投稿内容は必須です')
    .max(2000, '投稿内容は2000文字以内で入力してください'),
  hashtags: z.array(z.string()
    .max(50, 'ハッシュタグは50文字以内で入力してください')
    .regex(/^[a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/, 'ハッシュタグに無効な文字が含まれています'))
    .max(30, 'ハッシュタグは30個まで設定できます')
    .optional(),
  scheduled_for: z.string().datetime().optional(),
});

export const autoReplySchema = z.object({
  trigger_keywords: z.array(z.string()
    .min(1, 'キーワードは必須です')
    .max(50, 'キーワードは50文字以内で入力してください'))
    .min(1, '最低1つのキーワードは必要です')
    .max(20, 'キーワードは20個まで設定できます'),
  response_template: z.string()
    .min(1, '返信テンプレートは必須です')
    .max(500, '返信テンプレートは500文字以内で入力してください'),
});

// サニタイゼーション関数
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // script タグを削除
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // iframe タグを削除
    .replace(/javascript:/gi, '') // javascript: プロトコルを削除
    .replace(/on\w+\s*=/gi, '') // イベントハンドラを削除
    .trim();
};

export const sanitizeHtml = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// URL検証
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// UUID検証
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// SQLインジェクション防止のための基本的なチェック
export const containsSqlInjection = (input: string): boolean => {
  const sqlPatterns = [
    /('|(\\)|;|--|\/\*|\*\/|xp_|sp_)/i,
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
    /(script|javascript|vbscript|onload|onerror|onclick)/i
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
};

export const validateAndSanitize = (input: string, maxLength: number = 1000): string => {
  if (typeof input !== 'string') return '';
  
  // 長さチェック
  if (input.length > maxLength) {
    throw new Error(`入力が長すぎます。最大${maxLength}文字まで入力できます。`);
  }
  
  // SQLインジェクションチェック
  if (containsSqlInjection(input)) {
    throw new Error('無効な文字が含まれています。');
  }
  
  return sanitizeInput(input);
};
