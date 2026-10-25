'use client';

// ============================================================
// 备份面板（P2，2026-10-25）
// 挂在「旧纸张」抽屉底部：不新增首页入口。
// 只做两件事——导出到本机、从文件导入；不碰服务器。
// ============================================================

import { useRef, useState } from 'react';
import { exportBackup, importBackupFromFile } from './backup';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

export function BackupPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const handleExport = () => {
    try {
      const { fileName, counts } = exportBackup();
      setNotice({
        tone: 'ok',
        text: `已导出 ${counts.pages} 页（${fileName}）。收好这个文件，换设备时再用。`,
      });
    } catch (error) {
      console.error('[Backup] export failed:', error);
      setNotice({ tone: 'error', text: '导出没成功，浏览器可能禁用了下载。' });
    }
  };

  const handlePickFile = () => {
    setNotice(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 允许再次选择同一个文件
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const result = await importBackupFromFile(file);
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error });
        return;
      }
      const parts: string[] = [];
      if (result.pagesAdded > 0) parts.push(`新增 ${result.pagesAdded} 页`);
      if (result.pagesKept > 0) parts.push(`保留本机已有的 ${result.pagesKept} 页`);
      if (result.legacyAdded > 0) parts.push(`旧纸张 ${result.legacyAdded} 页`);
      if (result.observationsAdded > 0) parts.push(`观察 ${result.observationsAdded} 条`);
      const summary = parts.length > 0 ? parts.join('，') : '没有新的内容';
      setNotice({
        tone: 'ok',
        text: `${summary}。导入前的那份已存为 ${result.snapshotName}。`,
      });
    } catch (error) {
      console.error('[Backup] import failed:', error);
      setNotice({ tone: 'error', text: '导入没成功，书没有改动。' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 border-t border-[#7b5d3d]/22 pt-6">
      <p className="text-[9px] tracking-[0.32em] text-stone-500/60">BACKUP</p>
      <p className="mt-3 text-[12px] font-light leading-[1.9] tracking-[0.04em] text-stone-400/75">
        这本书只存在这台设备的浏览器里。换手机、清缓存、无痕窗口关掉，都会把页弄丢。
      </p>
      <p className="mt-2 text-[11px] font-light leading-[1.9] tracking-[0.03em] text-stone-500/60">
        备份是一个明文文件，里面有写过的全部内容。导进来只会追加，不会覆盖你现在写的页。
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          className="cursor-pointer border border-[#8b6b45]/40 px-4 py-2 text-[11px] tracking-[0.16em] text-stone-300/85 transition-colors hover:border-[#b28a5f]/60 hover:text-stone-100"
        >
          导出备份到本机
        </button>
        <button
          type="button"
          onClick={handlePickFile}
          disabled={busy}
          className="cursor-pointer border border-[#8b6b45]/22 px-4 py-2 text-[11px] tracking-[0.16em] text-stone-400/75 transition-colors hover:border-[#b28a5f]/45 hover:text-stone-200 disabled:cursor-default disabled:opacity-50"
        >
          {busy ? '正在导入…' : '从备份文件导入'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {notice ? (
        <p
          className={`mt-4 text-[11px] font-light leading-[1.9] tracking-[0.03em] ${
            notice.tone === 'error' ? 'text-[#c08a6a]' : 'text-stone-400/80'
          }`}
        >
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
