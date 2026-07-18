'use client';

import { useCallback, useState } from 'react';
import type { BookPage } from '../storage';
import { track } from '../analytics';

// 「渲染离屏分享卡 → html2canvas 截图 → 下载 PNG」的封装。
// 复用 app/counter 的成熟模式：动态 import html2canvas、scale 锁、toDataURL + anchor 下载。
// 使用方：把 share(page) 绑到分享按钮；sharing 表示进行中（按钮禁用）。

export function useShareCard() {
  const [sharing, setSharing] = useState(false);
  // 待截图的页面；非 null 时挂载离屏 ShareCard。
  const [pendingPage, setPendingPage] = useState<BookPage | null>(null);

  // 由 ShareCard 渲染完成后调用：真正截图 + 下载。
  const capture = useCallback(async (page: BookPage) => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const node = document.getElementById('share-card-node');
      if (!node) return;

      const canvas = await html2canvas(node, {
        backgroundColor: '#181412',
        scale: Math.min(window.devicePixelRatio || 1, 2), // 性能锁
        useCORS: true, // public 资源走 CORS，避免 canvas 被污染
      } as Parameters<typeof html2canvas>[1]);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `EndHere_${page.page_number}_${Date.now()}.png`;
      a.click();
      track('v5_page_shared');
    } catch {
      // 文案风格与 counter 页一致。
      window.alert('这一页没能保存成图，再试一次？');
    } finally {
      setPendingPage(null);
      setSharing(false);
    }
  }, []);

  const share = useCallback(
    (page: BookPage) => {
      if (sharing) return;
      setSharing(true);
      setPendingPage(page);
      // 下一帧再截图，确保离屏 ShareCard 已挂载、图片已布局。
      // 图片加载（logo/qr）给足时间：等两个 rAF 再 capture。
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void capture(page);
        });
      });
    },
    [sharing, capture],
  );

  return { share, sharing, pendingPage };
}
