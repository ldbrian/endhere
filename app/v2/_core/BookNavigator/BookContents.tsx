'use client';

import { motion } from 'framer-motion';
import type { BookPage } from '../storage';
import { getPageTitle, getPagePreview } from './utils';

// BookNavigator · Expanded
// 整本书的目录。点击 Collapsed 后在当前位置展开，悬浮覆盖在书卡上方，
// 书卡不被推动。承担真正的导航功能：快速跳转到任意一页。

export function BookContents({
  pages,
  currentPageIndex,
  onSelect,
  onClose,
}: {
  pages: BookPage[];
  currentPageIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      // 在当前位置展开：从 Collapsed 的 44px 高度展开到 420px，悬浮覆盖。
      initial={{ height: 44, opacity: 0.4 }}
      animate={{ height: 420, opacity: 1 }}
      exit={{ height: 44, opacity: 0.4 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-x-0 top-0 z-40 flex flex-col overflow-hidden rounded-[6px] border border-[#5d4631]/45 bg-[linear-gradient(180deg,#221b15_0%,#161210_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      {/* 顶部标题 */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <span className="font-mono text-[10px] tracking-[0.32em] text-stone-500">目录 / CONTENTS</span>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] tracking-[0.16em] text-stone-600 transition-colors hover:text-stone-300 cursor-pointer"
          aria-label="收起目录"
        >
          收起
        </button>
      </div>

      {/* 滚动列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 [scrollbar-width:thin]">
        {pages.map((page, index) => {
          const isActive = index === currentPageIndex;
          const title = getPageTitle(page);
          const preview = getPagePreview(page, 26);
          const isLast = index === pages.length - 1;

          return (
            <div key={page.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex w-full items-baseline gap-3 rounded-[3px] px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'border-l border-[#c9a86a]/55 bg-stone-200/[0.05]'
                    : 'border-l border-transparent hover:bg-stone-200/[0.03]'
                }`}
              >
                <span
                  className={`shrink-0 font-mono text-[11px] tracking-[0.16em] ${
                    isActive ? 'text-[#c9a86a]' : 'text-stone-600 group-hover:text-stone-400'
                  }`}
                >
                  {page.page_number}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[13px] tracking-[0.04em] ${
                      isActive ? 'text-stone-200' : 'text-stone-400 group-hover:text-stone-200'
                    }`}
                  >
                    {title || '（未命名的一页）'}
                  </span>
                  {preview ? (
                    <span className="mt-0.5 block truncate text-[11px] leading-[1.6] tracking-[0.02em] text-stone-600">
                      {preview}
                    </span>
                  ) : null}
                </span>
              </button>
              {!isLast ? <div className="mx-3 border-t border-stone-800/45" /> : null}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
