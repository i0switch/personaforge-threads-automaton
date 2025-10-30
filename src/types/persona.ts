import type { Database } from '@/integrations/supabase/types';

// Supabase自動生成型から派生（型の一元化）
export type Persona = Database['public']['Tables']['personas']['Row'];
export type PersonaInsert = Database['public']['Tables']['personas']['Insert'];
export type PersonaUpdate = Database['public']['Tables']['personas']['Update'];

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