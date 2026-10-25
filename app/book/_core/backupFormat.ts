// ============================================================
// 备份格式：纯函数层（无 DOM、无 store 依赖）
// ------------------------------------------------------------
// 单独拆出来的理由：合并逻辑一旦写错就是用户的书被吃掉。
// 拆成纯函数后可以在 Node 里直接跑用例（见 .tmp/backup-test.mjs 的生成方式），
// 不必等浏览器。
// ============================================================

export const BACKUP_FORMAT = 'endhere.backup.v1';

export type BackupPage = {
  id: string;
  page_number: string;
  title: string;
  status: string;
  paragraphs: unknown[];
  traces: unknown[];
  bookmarks: unknown[];
  opened_at: string;
  closed_at: string | null;
  [key: string]: unknown;
};

export type BackupCounts = {
  pages: number;
  paragraphs: number;
  legacy_pages: number;
  observations: number;
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  exported_at: string;
  owner_id: string;
  counts: BackupCounts;
  data: {
    book: { id: string; owner_id: string; pages: BackupPage[] };
    legacyArchive: { id: string; paragraphs: unknown[] }[];
    personaPreferences: Record<string, number>;
    ways: { id: string; fragment: string }[];
  };
};

export type MergePagesResult = {
  pages: BackupPage[];
  freshPages: BackupPage[];
  pagesKept: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function looksLikePage(value: unknown): value is BackupPage {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  if (!Array.isArray(value.paragraphs)) return false;
  if (!Array.isArray(value.traces)) return false;
  if (!Array.isArray(value.bookmarks)) return false;
  return true;
}

function looksLikeLegacyPage(value: unknown): value is { id: string; paragraphs: unknown[] } {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  return Array.isArray(value.paragraphs);
}

function looksLikeObservation(value: unknown): value is { id: string; fragment: string } {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && !!value.id && typeof value.fragment === 'string';
}

export type ParseOk = { ok: true; backup: BackupFile; skipped: number };
export type ParseFail = { ok: false; error: string };

/** 解析并逐项校验；坏页只丢坏页并计数，不整份拒绝 */
export function parseBackupText(text: string): ParseOk | ParseFail {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: '这个文件不是能读的备份（内容损坏或不是 JSON）。' };
  }

  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: '这不是 EndHere 的备份文件。' };
  }

  const data = raw.data;
  if (!isRecord(data) || !isRecord(data.book) || !Array.isArray(data.book.pages)) {
    return { ok: false, error: '备份里没有可以读的页。' };
  }

  let skipped = 0;

  const pages = (data.book.pages as unknown[]).filter((page): page is BackupPage => {
    if (looksLikePage(page)) return true;
    skipped += 1;
    return false;
  });

  const legacyArchive = (Array.isArray(data.legacyArchive) ? (data.legacyArchive as unknown[]) : []).filter(
    (page): page is { id: string; paragraphs: unknown[] } => {
      if (looksLikeLegacyPage(page)) return true;
      skipped += 1;
      return false;
    },
  );

  const ways = (Array.isArray(data.ways) ? (data.ways as unknown[]) : []).filter((item): item is { id: string; fragment: string } => {
    if (looksLikeObservation(item)) return true;
    skipped += 1;
    return false;
  });

  const backup = raw as unknown as BackupFile;
  backup.data.book = { ...backup.data.book, pages };
  backup.data.legacyArchive = legacyArchive;
  backup.data.ways = ways;

  return { ok: true, backup, skipped };
}

/** 按顺序重排页码：页码是位置，不是进度 */
export function renumberPages(pages: BackupPage[]): BackupPage[] {
  return pages.map((page, index) => ({ ...page, page_number: String(index + 1).padStart(3, '0') }));
}

/**
 * 合并页：本地全部保留，备份里新增的追加在后面，同 id 一律以本地为准。
 * 空白页（还没写字的书写位）最多只留末尾一页，避免书里夹一串空页。
 */
export function mergePages(localPages: BackupPage[], incomingPages: BackupPage[]): MergePagesResult {
  const localIds = new Set(localPages.map((page) => page.id));
  const freshPages = incomingPages.filter((page) => !localIds.has(page.id));
  const combined = [...localPages, ...freshPages];
  const trimmed = combined.filter(
    (page, index) => page.paragraphs.length > 0 || index === combined.length - 1,
  );
  const safe = trimmed.length > 0 ? trimmed : combined.slice(-1);
  return { pages: renumberPages(safe), freshPages, pagesKept: incomingPages.length - freshPages.length };
}

/** 人格偏好取较大值而不是相加：同一份备份导入两次不会翻倍 */
export function mergePersonaPreferences(
  local: Record<string, number>,
  incoming: Record<string, number> | undefined,
): Record<string, number> {
  if (!incoming || typeof incoming !== 'object') return local;
  const next: Record<string, number> = { ...local };
  for (const key of Object.keys(next)) {
    const value = typeof incoming[key] === 'number' ? incoming[key] : 0;
    next[key] = Math.max(next[key] || 0, value);
  }
  return next;
}
