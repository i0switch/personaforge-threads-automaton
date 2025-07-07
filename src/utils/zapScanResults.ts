// ZAPスキャン結果の分析データ
export interface ZapAlert {
  id: string;
  name: string;
  riskLevel: 'high' | 'medium' | 'low' | 'info';
  confidence: 'high' | 'medium' | 'low';
  description: string;
  solution: string;
  affected_urls: string[];
  status: 'resolved' | 'investigating' | 'acknowledged' | 'pending';
  detected_at: string;
}

export const zapScanResults: ZapAlert[] = [
  {
    id: 'csp-missing',
    name: 'Content Security Policy (CSP) ヘッダーが設定されていません',
    riskLevel: 'medium',
    confidence: 'high',
    description: 'Content Security Policy (CSP)は、クロスサイトスクリプティング（XSS）やデータインジェクション攻撃などを検知・緩和するためのセキュリティ層です。このヘッダーが設定されていないため、これらの攻撃に対して脆弱である可能性があります。',
    solution: 'ウェブサーバーがContent-Security-Policyヘッダーを送信するように設定してください。',
    affected_urls: ['https://threads-genius-ai.lovable.app/sitemap.xml'],
    status: 'resolved',
    detected_at: '2025-07-08T00:02:51Z'
  },
  {
    id: 'clickjacking-protection',
    name: 'クリックジャッキング対策ヘッダーの欠落',
    riskLevel: 'medium',
    confidence: 'medium',
    description: 'レスポンスにクリックジャッキング攻撃を防ぐためのX-Frame-Optionsヘッダーや、CSPのframe-ancestorsディレクティブが含まれていません。これにより、悪意のあるサイトが透明なフレーム（iframe）を使ってユーザーを騙し、意図しない操作をさせる可能性があります。',
    solution: 'すべてのページでX-Frame-Optionsヘッダー（例: DENY, SAMEORIGIN）またはCSPのframe-ancestorsディレクティブを設定してください。',
    affected_urls: ['https://threads-genius-ai.lovable.app'],
    status: 'resolved',
    detected_at: '2025-07-08T00:02:51Z'
  },
  {
    id: 'cors-misconfiguration',
    name: 'クロスドメインの設定ミス',
    riskLevel: 'medium',
    confidence: 'medium',
    description: 'クロスオリジンリソースシェアリング（CORS）の設定が過度に緩く（Access-Control-Allow-Origin: *）、任意の第三者ドメインからのデータ読み取りリクエストを許可しています。これにより、意図しない情報漏洩につながる可能性があります。',
    solution: 'Access-Control-Allow-Originヘッダーで許可するドメインを信頼できるものに限定するか、不要であればCORS関連のヘッダーを削除してください。',
    affected_urls: ['https://threads-genius-ai.lovable.app/~flock.js'],
    status: 'acknowledged',
    detected_at: '2025-07-08T00:02:51Z'
  },
  {
    id: 'hidden-files',
    name: '隠しファイルの発見',
    riskLevel: 'medium',
    confidence: 'low',
    description: 'BitKeeperという、機密情報を含む可能性のあるファイルまたはディレクトリがアクセス可能になっています。これはバージョン管理システムのファイルであり、設定情報や認証情報が漏洩するリスクがあります。',
    solution: 'このファイルやディレクトリが本番環境で不要な場合は無効化または削除してください。必要な場合は、適切な認証・認可を設定してください。',
    affected_urls: ['https://threads-genius-ai.lovable.app/BitKeeper'],
    status: 'investigating',
    detected_at: '2025-07-08T00:02:51Z'
  },
  {
    id: 'hsts-missing',
    name: 'Strict-Transport-Security ヘッダーが設定されていません',
    riskLevel: 'low',
    confidence: 'high',
    description: 'HTTP Strict Transport Security (HSTS)ヘッダーが設定されていません。このため、ブラウザは常にHTTPSで接続するよう強制されず、中間者攻撃に対して脆弱になる可能性があります。',
    solution: 'サーバーがStrict-Transport-Securityヘッダーを強制するように設定してください。',
    affected_urls: ['https://threads-genius-ai.lovable.app/robots.txt'],
    status: 'acknowledged',
    detected_at: '2025-07-08T00:02:51Z'
  },
  {
    id: 'content-type-options',
    name: 'X-Content-Type-Options ヘッダーの欠落',
    riskLevel: 'low',
    confidence: 'medium',
    description: 'X-Content-Type-Optionsヘッダーがnosniffに設定されていません。これにより、一部のブラウザがコンテンツタイプを誤って解釈し、本来とは異なる形式で表示してしまう（MIMEスニッフィング）可能性があります。',
    solution: 'すべてのウェブページでX-Content-Type-Optionsヘッダーをnosniffに設定してください。',
    affected_urls: ['https://threads-genius-ai.lovable.app/robots.txt'],
    status: 'resolved',
    detected_at: '2025-07-08T00:02:51Z'
  }
];

export const getZapScanSummary = () => {
  const summary = {
    total: zapScanResults.length,
    high: zapScanResults.filter(alert => alert.riskLevel === 'high').length,
    medium: zapScanResults.filter(alert => alert.riskLevel === 'medium').length,
    low: zapScanResults.filter(alert => alert.riskLevel === 'low').length,
    info: zapScanResults.filter(alert => alert.riskLevel === 'info').length,
    resolved: zapScanResults.filter(alert => alert.status === 'resolved').length,
    pending: zapScanResults.filter(alert => alert.status === 'pending').length,
    investigating: zapScanResults.filter(alert => alert.status === 'investigating').length,
    acknowledged: zapScanResults.filter(alert => alert.status === 'acknowledged').length
  };

  return summary;
};

export const getRiskColor = (riskLevel: string) => {
  switch (riskLevel) {
    case 'high': return 'text-red-600 bg-red-50';
    case 'medium': return 'text-yellow-600 bg-yellow-50';
    case 'low': return 'text-blue-600 bg-blue-50';
    case 'info': return 'text-gray-600 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'resolved': return 'text-green-600 bg-green-50';
    case 'investigating': return 'text-orange-600 bg-orange-50';
    case 'acknowledged': return 'text-blue-600 bg-blue-50';
    case 'pending': return 'text-red-600 bg-red-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};