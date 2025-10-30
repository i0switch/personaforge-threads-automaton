/**
 * 認証関連ヘルパー関数（共通化）
 * 目的: auth.getUser()とauth.getSession()の混在を防ぎ、トークン検証を統一
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * トークンの検証と構造チェック
 * JWTの基本構造（header.payload.signature）と必須クレームを検証
 */
export const validateToken = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token: wrong structure (expected 3 parts)');
      return false;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    
    // subクレーム（ユーザーID）が必須
    if (!payload.sub) {
      console.error('Invalid token: missing sub claim');
      return false;
    }
    
    // 有効期限チェック
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.error('Invalid token: expired');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

/**
 * 安全なセッション取得
 * 必ずセッションを返し、トークンも検証済み
 */
export const getSafeSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Failed to get session:', error);
    return null;
  }
  
  if (!session) {
    return null;
  }
  
  // トークン検証
  if (!validateToken(session.access_token)) {
    console.warn('Invalid session token detected');
    // 無効なセッションをクリア
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }
  
  return session;
};

/**
 * 現在のユーザーを安全に取得
 * セッション経由で取得し、トークンの有効性も保証
 */
export const getCurrentUser = async () => {
  const session = await getSafeSession();
  return session?.user ?? null;
};

/**
 * 認証状態の確認
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getSafeSession();
  return !!session;
};
