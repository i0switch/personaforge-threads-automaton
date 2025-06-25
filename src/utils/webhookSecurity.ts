
interface WebhookSecurityConfig {
  maxRequestSize: number;
  timestampToleranceSeconds: number;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
}

const DEFAULT_CONFIG: WebhookSecurityConfig = {
  maxRequestSize: 1024 * 1024, // 1MB
  timestampToleranceSeconds: 300, // 5分
  rateLimitWindow: 60 * 1000, // 1分
  rateLimitMaxRequests: 60, // 1分間に60リクエスト
};

// Rate limiting storage (メモリベース、本番環境ではRedisなどを使用)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export class WebhookSecurityValidator {
  private config: WebhookSecurityConfig;

  constructor(config: Partial<WebhookSecurityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // リクエストサイズの検証
  validateRequestSize(bodySize: number): boolean {
    return bodySize <= this.config.maxRequestSize;
  }

  // タイムスタンプの検証（リプレイ攻撃対策）
  validateTimestamp(timestamp: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);
    
    if (isNaN(webhookTime)) {
      return false;
    }

    const timeDiff = Math.abs(now - webhookTime);
    return timeDiff <= this.config.timestampToleranceSeconds;
  }

  // HMAC署名の検証（タイミング攻撃対策）
  async verifySignature(
    payload: string,
    signature: string,
    secret: string,
    timestamp?: string
  ): Promise<boolean> {
    try {
      // タイムスタンプが提供されている場合は検証
      if (timestamp && !this.validateTimestamp(timestamp)) {
        console.error('Webhook timestamp validation failed');
        return false;
      }

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      // タイムスタンプを含めた署名の生成
      const signaturePayload = timestamp ? `${timestamp}.${payload}` : payload;
      const expectedSignature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signaturePayload)
      );

      const expectedHex = 'sha256=' + Array.from(new Uint8Array(expectedSignature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // タイミング攻撃対策のための定数時間比較
      return this.constantTimeCompare(expectedHex, signature);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // 定数時間での文字列比較（タイミング攻撃対策）
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  // レート制限の検証
  validateRateLimit(identifier: string): boolean {
    const now = Date.now();
    const key = `webhook_${identifier}`;
    const existing = rateLimitStore.get(key);

    if (!existing || now > existing.resetTime) {
      // 新しいウィンドウの開始
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.config.rateLimitWindow
      });
      return true;
    }

    if (existing.count >= this.config.rateLimitMaxRequests) {
      return false;
    }

    // カウントを増加
    existing.count++;
    rateLimitStore.set(key, existing);
    return true;
  }

  // 入力値のサニタイゼーション（強化版）
  sanitizeInput(input: unknown, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .slice(0, maxLength)
      .replace(/[<>]/g, '') // HTMLタグの除去
      .replace(/[\x00-\x1F\x7F]/g, '') // 制御文字の除去
      .trim();
  }

  // JSONスキーマの検証
  validateJsonSchema(data: unknown, schema: any): boolean {
    // 基本的なスキーマ検証の実装
    // 本番環境では ajv などのライブラリを使用することを推奨
    try {
      if (typeof data !== 'object' || data === null) {
        return false;
      }

      // 必須フィールドの検証
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in data)) {
            return false;
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // セキュリティログの生成
  generateSecurityLog(event: string, details: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details: this.sanitizeLogDetails(details),
      severity: this.getEventSeverity(event)
    };

    console.log('Security Event:', JSON.stringify(logEntry));
    
    // 本番環境では外部ログサービスに送信
    // this.sendToSecurityLogger(logEntry);
  }

  private sanitizeLogDetails(details: any): any {
    // ログに含めてはいけない情報をマスク
    const sanitized = { ...details };
    
    if (sanitized.signature) {
      sanitized.signature = '[REDACTED]';
    }
    if (sanitized.secret) {
      sanitized.secret = '[REDACTED]';
    }
    if (sanitized.token) {
      sanitized.token = '[REDACTED]';
    }

    return sanitized;
  }

  private getEventSeverity(event: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'signature_verification_failed': 'high',
      'rate_limit_exceeded': 'medium',
      'timestamp_validation_failed': 'medium',
      'request_size_exceeded': 'medium',
      'invalid_json_schema': 'low',
      'webhook_processed': 'low'
    };

    return severityMap[event] || 'low';
  }
}

export const webhookValidator = new WebhookSecurityValidator();
