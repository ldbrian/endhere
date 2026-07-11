import type { BookPage } from '../storage';

// ── Page title / preview derivation ──────────────────────────
// 这些 helpers 之前内联在 app/v2/page.tsx，重构时迁出，集中维护。
// preview 只取用户写下的正文（paragraph.text），绝不取 AI 回应（trace）。

/** 从若干段纯文本中取出短标题（去标点后取前 6–12 字）。 */
export function extractPageTitle(paragraphs: string[]) {
  const joined = paragraphs.join('').replace(/\s+/g, '').trim();
  if (!joined) return '';
  const cleaned = joined.replace(/[，。！？；：、…—「」『』""''（）《》【】,.!?;:'"()\[\]<>]/g, '');
  if (cleaned.length <= 12) return cleaned;
  for (let length = 12; length >= 6; length -= 1) {
    const slice = cleaned.slice(0, length).trim();
    if (slice.length >= 6) return slice;
  }
  return cleaned.slice(0, 8);
}

/** 把一段正文截断为预览（默认不超 26 字，超出加省略号）。 */
export function formatPreviewText(text: string, limit: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit).trim() + '…';
}

/** 取一页的标题：优先 page.title，否则从正文派生。 */
export function getPageTitle(page: BookPage) {
  if (page.title.trim()) return page.title;
  return extractPageTitle(page.paragraphs.map((p) => p.text));
}

/** 取一页的正文预览：来自第一个非空的 paragraph.text。绝不用 trace。 */
export function getPagePreview(page: BookPage, limit = 26) {
  for (const paragraph of page.paragraphs) {
    const text = paragraph.text?.replace(/\s+/g, ' ').trim();
    if (text) return formatPreviewText(text, limit);
  }
  return '';
}
