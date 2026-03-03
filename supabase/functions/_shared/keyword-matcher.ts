export function normalizeEmojiAndText(text: string): string {
  if (!text) return '';
  
  return text
    .normalize('NFC') // Unicode正規化（NFCで統一）
    .replace(/[\u200d\uFE0E\uFE0F]/g, '') // Zero Width Joiner と variation selector除去
    .replace(/\s+/g, ' ') // 複数空白を単一空白に
    .trim()
    .toLowerCase();
}

export function isKeywordMatch(replyText: string, keyword: string): boolean {
  const normalizedReply = normalizeEmojiAndText(replyText);
  const normalizedKeyword = normalizeEmojiAndText(keyword);
  
  // 完全一致チェック
  if (normalizedReply === normalizedKeyword) {
    return true;
  }
  
  // 複数文字のキーワード（またはテキスト）は部分一致を許可
  if (normalizedKeyword.length > 1) {
    return normalizedReply.includes(normalizedKeyword);
  }

  // 単一文字（絵文字など）の場合は厳密チェック（完全一致）
  return normalizedReply === normalizedKeyword;
}

export function matchKeywords(replyText: string, keywords: string[]): { matched: boolean; keyword?: string } {
  if (!keywords || keywords.length === 0) {
    return { matched: false };
  }

  for (const keyword of keywords) {
    if (isKeywordMatch(replyText, keyword)) {
      return { matched: true, keyword };
    }
  }

  return { matched: false };
}
