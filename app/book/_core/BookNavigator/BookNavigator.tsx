'use client';

import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { BookPage } from '../storage';
import { BookProgress } from './BookProgress';
import { BookContents } from './BookContents';

// BookNavigator ── 一本会慢慢认识你的书
// Collapsed：书的生命进度（首页 — 整条线 — 末页），不是页码导航。
// Expanded：整本书的目录，悬浮覆盖，承担真正的跳转。
//
// 宽度恒定 max 340px，不随页数变化；所有定位全用百分比。

export function BookNavigator({
  pages,
  currentPageIndex,
  mirrorMarks,
  onSelect,
}: {
  pages: BookPage[];
  currentPageIndex: number;
  mirrorMarks: number[];
  onSelect: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const total = pages.length;
  const first = pages[0]?.page_number ?? '001';
  const last = pages[total - 1]?.page_number ?? '001';
  // 除零保护：只有一页时进度归 0（首页即末页）。
  const progress = total > 1 ? currentPageIndex / (total - 1) : 0;

  const handleSelect = (index: number) => {
    onSelect(index);
    // 点击任意页后自动收起目录。
    setExpanded(false);
  };

  return (
    <div className="relative w-full max-w-[340px]">
      <BookProgress
        first={first}
        last={last}
        progress={progress}
        mirrorMarks={mirrorMarks}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      <AnimatePresence>
        {expanded ? (
          <BookContents
            pages={pages}
            currentPageIndex={currentPageIndex}
            onSelect={handleSelect}
            onClose={() => setExpanded(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
