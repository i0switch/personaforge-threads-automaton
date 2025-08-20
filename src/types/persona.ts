// 統一されたPersonaインターフェース（データベーススキーマと一致）
export interface Persona {
  id: string;
  user_id: string;
  name: string;
  age: string | null;
  personality: string | null;
  expertise: string[] | null;
  tone_of_voice: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  threads_access_token: string | null;
  threads_app_id: string | null;
  threads_app_secret: string | null;
  webhook_verify_token: string | null;
  threads_username: string | null;
  auto_reply_enabled: boolean | null;
  ai_auto_reply_enabled: boolean | null;
  auto_reply_delay_minutes: number | null;
  threads_user_id: string | null;
  app_identifier: string | null;
}

// フォーム用の型（編集時に使用）
export interface PersonaFormData {
  name: string;
  age: string;
  personality: string;
  expertise: string; // フォームではカンマ区切り文字列
  tone_of_voice: string;
  avatar_url: string;
  threads_app_id: string;
  threads_app_secret: string;
  threads_access_token: string;
  threads_username: string;
  webhook_verify_token: string;
  auto_reply_enabled: boolean;
  ai_auto_reply_enabled: boolean;
  auto_reply_delay_minutes: number;
}

// 自動返信モードを計算するヘルパー関数
export const getPersonaReplyMode = (persona: Persona): 'ai' | 'keyword' | 'disabled' => {
  if (persona.ai_auto_reply_enabled) return 'ai';
  if (persona.auto_reply_enabled) return 'keyword';
  return 'disabled';
};

// 返信モードラベルを取得するヘルパー関数
export const getReplyModeLabel = (mode: 'ai' | 'keyword' | 'disabled') => {
  switch (mode) {
    case 'ai':
      return { label: 'AI自動返信', variant: 'default' as const };
    case 'keyword':
      return { label: 'キーワード返信', variant: 'secondary' as const };
    default:
      return { label: '無効', variant: 'outline' as const };
  }
};