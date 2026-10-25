'use client';

// ============================================================
// 导出备份 / 导入备份（P2，2026-10-25）
// ------------------------------------------------------------
// 解决的问题：书页只存在 localStorage，换手机、清缓存、无痕模式一结束就全丢。
// 不解决的问题：「长期」观察。导入后镜中书仍然只能用本机数据——
//   真正的跨设备同步是另一件事（本轮定为不做），备份是搬家工具，不是同步。
//
// 原则：
// 1. 导出必须是用户主动点、下载到自己设备，绝不上传服务器。
// 2. 导入只做「追加 + 保留」，本地已有的页一律以本地为准，绝不覆盖用户现在写的东西。
// 3. 导入前先备一份快照，误操作可回退。
// 4. 文件是明文 JSON，含用户写过的全部内容，UI 必须明说这一点。
//
// 纯逻辑（解析、合并）在 backupFormat.ts，可在 Node 里直接测。
// ============================================================

import { type Book, type BookPage, type LegacyPage, createEmptyPage, useFragmentStore } from './storage';
import type { Observation } from '../../lib/ways/lens';
import { useWaysArchive } from './waysArchive';
import { track } from '../../lib/track';
import {
  BACKUP_FORMAT,
  mergePages,
  mergePersonaPreferences,
  parseBackupText,
  type BackupCounts,
  type BackupFile,
  type BackupPage,
} from './backupFormat';

export { BACKUP_FORMAT, parseBackupText };
export type { BackupCounts, BackupFile };

export type ImportResult =
  | {
      ok: true;
      pagesAdded: number;
      pagesKept: number;
      legacyAdded: number;
      observationsAdded: number;
      skipped: number;
      /** 导入前的自动快照文件名，便于用户回退 */
      snapshotName: string;
    }
  | { ok: false; error: string };

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function stamp(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function countParagraphs(pages: BookPage[]) {
  return pages.reduce((sum, page) => sum + (Array.isArray(page.paragraphs) ? page.paragraphs.length : 0), 0);
}

/** 从当前内存态组一份备份对象 */
export function buildBackup(): BackupFile {
  const state = useFragmentStore.getState();
  const ways = useWaysArchive.getState().observations;
  const pages = state.book.pages;

  return {
    format: BACKUP_FORMAT,
    exported_at: new Date().toISOString(),
    owner_id: state.ownerId,
    counts: {
      pages: pages.filter((page) => page.paragraphs.length > 0).length,
      paragraphs: countParagraphs(pages),
      legacy_pages: state.legacyArchive.length,
      observations: ways.length,
    },
    data: {
      book: state.book as unknown as BackupFile['data']['book'],
      legacyArchive: state.legacyArchive as unknown as BackupFile['data']['legacyArchive'],
      personaPreferences: state.personaPreferences as unknown as Record<string, number>,
      ways: ways as unknown as BackupFile['data']['ways'],
    },
  };
}

function triggerDownload(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Safari 需要一点延迟再释放，否则下载会被取消
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 导出备份：用户主动下载到自己设备，不上传 */
export function exportBackup(prefix = 'endhere-backup'): { fileName: string; counts: BackupCounts } {
  const backup = buildBackup();
  const fileName = `${prefix}-${stamp()}.json`;
  triggerDownload(fileName, JSON.stringify(backup, null, 2));
  void track('v5_backup_exported', {
    pages: backup.counts.pages,
    paragraphs: backup.counts.paragraphs,
    legacy_pages: backup.counts.legacy_pages,
    observations: backup.counts.observations,
  });
  return { fileName, counts: backup.counts };
}

/**
 * 导入备份：只追加不覆盖。
 * - 页按 id 去重，本地已有同 id 一律保留本地
 * - 新页追加后按顺序重排页码
 * - 旧纸张档案、换角度观察同样按 id 合并
 * - 动手前先导出一份 pre-import 快照
 */
export async function importBackupFromText(text: string): Promise<ImportResult> {
  const parsed = parseBackupText(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const incoming = parsed.backup;

  // 先拍快照（在任何改动之前），导入完再交给用户
  const snapshotName = `endhere-pre-import-${stamp()}.json`;
  const snapshotText = JSON.stringify(buildBackup(), null, 2);

  const state = useFragmentStore.getState();
  const merged = mergePages(
    state.book.pages as unknown as BackupPage[],
    incoming.data.book.pages,
  );
  const mergedPages = (merged.pages.length > 0 ? merged.pages : [createEmptyPage(0)]) as unknown as BookPage[];
  const newPageIds = new Set(merged.freshPages.map((page) => page.id));

  const localLegacyIds = new Set(state.legacyArchive.map((page) => page.id));
  const freshLegacy = (incoming.data.legacyArchive as unknown as LegacyPage[]).filter(
    (page) => !localLegacyIds.has(page.id),
  );

  const waysState = useWaysArchive.getState();
  const localObservationIds = new Set(waysState.observations.map((item) => item.id));
  const freshObservations = (incoming.data.ways as unknown as Observation[]).filter(
    (item) => !localObservationIds.has(item.id),
  );

  // 落书：走 store action，保证 localFragments 等派生字段一起刷新
  useFragmentStore.getState().importBackupData({
    book: { ...state.book, pages: mergedPages },
    legacyArchive: freshLegacy.length > 0 ? [...state.legacyArchive, ...freshLegacy] : state.legacyArchive,
    personaPreferences: mergePersonaPreferences(
      state.personaPreferences as unknown as Record<string, number>,
      incoming.data.personaPreferences,
    ) as unknown as typeof state.personaPreferences,
    focusPageId: newPageIds.size > 0 ? merged.freshPages[0].id : undefined,
  });

  if (freshObservations.length > 0) {
    useWaysArchive.setState({ observations: [...waysState.observations, ...freshObservations] });
  }

  triggerDownload(snapshotName, snapshotText);

  void track('v5_backup_imported', {
    pages_added: merged.freshPages.length,
    pages_kept: merged.pagesKept,
    legacy_added: freshLegacy.length,
    observations_added: freshObservations.length,
    skipped: parsed.skipped,
  });

  return {
    ok: true,
    pagesAdded: merged.freshPages.length,
    pagesKept: merged.pagesKept,
    legacyAdded: freshLegacy.length,
    observationsAdded: freshObservations.length,
    skipped: parsed.skipped,
    snapshotName,
  };
}

/** 从 File 对象导入（浏览器 file input 用） */
export async function importBackupFromFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: '这个文件太大了，不像是书的备份。' };
  }
  let text = '';
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: '读不了这个文件。' };
  }
  return importBackupFromText(text);
}
