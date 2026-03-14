/**
 * 統一暗号化/復号ユーティリティ
 * 
 * 全Edge Functionはこのモジュールを通じて復号を行う。
 * 暗号方式: AES-256-GCM (raw key / SHA-256 normalized)
 * フォールバック: PBKDF2-derived AES-256-GCM (レガシー)
 * 
 * IMPORTANT: DB RPCによる復号は禁止。全ての復号はこのモジュールで行う。
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const LEGACY_PBKDF2_SALT = encoder.encode('salt');
const V2_PREFIX = 'v2:';

export type DecryptResult = {
  success: true;
  value: string;
  method: 'aes-gcm-raw' | 'aes-gcm-pbkdf2';
} | {
  success: false;
  error: string;
  errorType: 'no_encryption_key' | 'base64_decode_failed' | 'decrypt_failed' | 'plaintext_passthrough';
};

/**
 * ENCRYPTION_KEYを取得
 */
function getEncryptionKey(): string | null {
  return Deno.env.get('ENCRYPTION_KEY') ?? null;
}

/**
 * AES-GCM raw key方式で復号
 */
async function decryptWithRawKey(
  iv: Uint8Array,
  ciphertext: Uint8Array,
  encryptionKey: string
): Promise<string> {
  const keyBytes = encoder.encode(encryptionKey);
  const keyCandidates: Uint8Array[] = [];

  if (keyBytes.length === 32) {
    keyCandidates.push(keyBytes);
  } else {
    const digest = await crypto.subtle.digest('SHA-256', keyBytes);
    keyCandidates.push(new Uint8Array(digest));

    const legacyPadded = new Uint8Array(32);
    legacyPadded.set(keyBytes.slice(0, 32));
    keyCandidates.push(legacyPadded);
  }

  let lastError: unknown;
  for (const candidate of keyCandidates) {
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(candidate).buffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
        keyMaterial,
        new Uint8Array(ciphertext).buffer
      );
      return decoder.decode(decrypted);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('AES-GCM raw key decryption failed');
}

async function derivePBKDF2Key(
  encryptionKey: string,
  salt: Uint8Array,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt).buffer, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
}

/**
 * PBKDF2-derived AES-GCM方式で復号（レガシーフォールバック）
 */
async function decryptWithPBKDF2(
  iv: Uint8Array,
  ciphertext: Uint8Array,
  encryptionKey: string,
  salt: Uint8Array = LEGACY_PBKDF2_SALT
): Promise<string> {
  const derivedKey = await derivePBKDF2Key(encryptionKey, salt, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
    derivedKey,
    new Uint8Array(ciphertext).buffer
  );
  return decoder.decode(decrypted);
}

/**
 * 暗号化された値を復号する。
 * 
 * @param encryptedValue - Base64エンコードされた暗号文 (IV 12bytes + ciphertext)
 * @param context - ログ用コンテキスト（例: "app_secret for persona X"）
 * @returns DecryptResult
 */
export async function decryptValue(
  encryptedValue: string,
  context: string = 'unknown'
): Promise<DecryptResult> {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    console.error(`❌ [decrypt] ENCRYPTION_KEY未設定 - context: ${context}`);
    return { success: false, error: 'ENCRYPTION_KEY not configured', errorType: 'no_encryption_key' };
  }

  if (encryptedValue.startsWith(V2_PREFIX)) {
    try {
      const payload = encryptedValue.slice(V2_PREFIX.length);
      const v2Data = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
      if (v2Data.length < 29) {
        return { success: false, error: 'V2 encrypted data too short', errorType: 'decrypt_failed' };
      }
      const iv = v2Data.slice(0, 12);
      const salt = v2Data.slice(12, 28);
      const ciphertext = v2Data.slice(28);
      const value = await decryptWithPBKDF2(iv, ciphertext, encryptionKey, salt);
      console.log(`🔓 [decrypt] 成功 (PBKDF2 v2) - context: ${context}`);
      return { success: true, value, method: 'aes-gcm-pbkdf2' };
    } catch (e) {
      console.error(`❌ [decrypt] V2復号失敗 - context: ${context}, error: ${e}`);
      return { success: false, error: 'V2 decryption failed', errorType: 'decrypt_failed' };
    }
  }

  // Base64デコード
  let encryptedData: Uint8Array;
  try {
    encryptedData = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));
  } catch (e) {
    console.error(`❌ [decrypt] Base64デコード失敗 - context: ${context}, error: ${e}`);
    return { success: false, error: 'Base64 decode failed', errorType: 'base64_decode_failed' };
  }

  if (encryptedData.length < 13) {
    console.error(`❌ [decrypt] データ長不足 (${encryptedData.length} bytes) - context: ${context}`);
    return { success: false, error: 'Encrypted data too short', errorType: 'decrypt_failed' };
  }

  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  // 方式1: AES-GCM raw key
  try {
    const value = await decryptWithRawKey(iv, ciphertext, encryptionKey);
    console.log(`🔓 [decrypt] 成功 (AES-GCM raw) - context: ${context}`);
    return { success: true, value, method: 'aes-gcm-raw' };
  } catch (_e) {
    // 方式2にフォールバック
  }

  // 方式2: PBKDF2-derived AES-GCM (レガシー)
  try {
    const value = await decryptWithPBKDF2(iv, ciphertext, encryptionKey);
    console.log(`🔓 [decrypt] 成功 (PBKDF2 legacy) - context: ${context}`);
    return { success: true, value, method: 'aes-gcm-pbkdf2' };
  } catch (e) {
    console.error(`❌ [decrypt] 両方式で復号失敗 - context: ${context}, error: ${e}`);
    return { success: false, error: 'Decryption failed with both methods', errorType: 'decrypt_failed' };
  }
}

export async function encryptValue(
  plainValue: string,
  context: string = 'unknown'
): Promise<string | null> {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    console.error(`❌ [encrypt] ENCRYPTION_KEY未設定 - context: ${context}`);
    return null;
  }

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await derivePBKDF2Key(encryptionKey, salt, ['encrypt']);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plainValue)
    );

    const combined = new Uint8Array(iv.length + salt.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(salt, iv.length);
    combined.set(new Uint8Array(encrypted), iv.length + salt.length);

    return `${V2_PREFIX}${btoa(String.fromCharCode(...combined))}`;
  } catch (error) {
    console.error(`❌ [encrypt] 暗号化失敗 - context: ${context}, error: ${error}`);
    return null;
  }
}

/**
 * 値が暗号化されているかを判定する。
 * 平文トークン（THAA...）や短い値は暗号化されていないと判定。
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('THAA')) return false;
  if (value === 'ENCRYPTED_VIA_EDGE_FUNCTION') return false;
  // 短い値は平文と判定（App Secretは通常32文字程度）
  if (value.length <= 40) return false;
  return true;
}

/**
 * 暗号化された値を安全に復号する。
 * 平文の場合はそのまま返す。
 */
export async function decryptIfNeeded(
  value: string,
  context: string = 'unknown'
): Promise<string | null> {
  if (!value) return null;
  
  if (!isEncrypted(value)) {
    console.log(`ℹ️ [decrypt] 平文として使用 - context: ${context}`);
    return value;
  }

  const result = await decryptValue(value, context);
  if (result.success) {
    return result.value;
  }
  
  console.error(`❌ [decrypt] 復号失敗、null返却 - context: ${context}, errorType: ${result.errorType}`);
  return null;
}

/**
 * DBからユーザーAPIキーを取得して復号する共通関数。
 * user_api_keysテーブルから暗号化されたキーを取得し復号する。
 */
export async function getUserApiKeyDecrypted(
  supabase: any,
  userId: string,
  keyName: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (error || !data?.encrypted_key) {
      return null;
    }

    const result = await decryptValue(data.encrypted_key, `api_key:${keyName}`);
    if (result.success) {
      return result.value;
    }
    
    console.error(`❌ APIキー復号失敗: ${keyName}, errorType: ${result.errorType}`);
    return null;
  } catch (e) {
    console.error(`❌ APIキー取得エラー: ${keyName}`, e);
    return null;
  }
}

/**
 * HMAC-SHA256 署名を定数時間比較で検証する。
 * Meta X-Hub-Signature-256 対応。
 */
export async function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      console.error('❌ [hmac] 署名ヘッダー形式不正');
      return false;
    }

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(rawBody)
    );

    const expectedHex = 'sha256=' + Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // 定数時間比較（タイミング攻撃対策）
    const provided = signatureHeader;
    if (expectedHex.length !== provided.length) return false;
    
    let result = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      result |= expectedHex.charCodeAt(i) ^ provided.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.error('❌ [hmac] 検証エラー:', error);
    return false;
  }
}
