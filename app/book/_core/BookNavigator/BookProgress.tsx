'use client';

import { ProgressMarker } from './ProgressMarker';
import { MirrorMarks } from './MirrorMarks';

// BookNavigator · Collapsed
// 一本书的生命进度：首页号 — 整条横线 — 末页号。
// 横线永远撑满，宽度不随页数变化。它首先是书的生命进度，而不是页码导航。

export function BookProgress({
  first,
  last,
  progress,
  mirrorMarks,
  expanded,
  onToggle,
}: {
  first: string;
  last: string;
  progress: number;
  mirrorMarks: number[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? '收起目录' : '展开目录'}
      className="group flex h-[44px] w-full items-center gap-3 text-stone-500/80 outline-none cursor-pointer"
    >
      {/* 首页号 —— 固定宽度 */}
      <span className="w-10 shrink-0 text-left font-mono text-[10px] tracking-[0.24em] text-stone-600/75 transition-colors group-hover:text-stone-500">
        {first}
      </span>

      {/* 横线 —— 永远撑满，内部全用百分比定位 */}
      <div className="relative flex h-px min-w-0 flex-1 items-center bg-stone-800/60 transition-colors group-hover:bg-stone-700/70">
        <MirrorMarks marks={mirrorMarks} />
        <ProgressMarker progress={progress} />
      </div>

      {/* 末页号 —— 固定宽度 */}
      <span className="w-10 shrink-0 text-right font-mono text-[10px] tracking-[0.24em] text-stone-600/75 transition-colors group-hover:text-stone-500">
        {last}
      </span>
    </button>
  );
}
