'use client';

import { useMemo, useState } from 'react';

type TracePhase = 'fresh' | 'fading' | 'folded';

function daysSince(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
}

function getTracePhase(createdAt: string): TracePhase {
  const days = daysSince(createdAt);
  if (days < 30) return 'fresh';
  if (days < 180) return 'fading';
  return 'folded';
}

export function TraceMark({ text, createdAt }: { text: string; createdAt: string }) {
  const [open, setOpen] = useState(false);
  const content = text.trim();
  const phase = useMemo(() => getTracePhase(createdAt), [createdAt]);

  if (!content) return null;

  if (phase === 'folded' && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 border-b border-dashed border-stone-700 pb-1 text-left text-[10px] tracking-[0.16em] text-stone-600 transition-colors duration-500 hover:border-stone-500 hover:text-stone-400"
      >
        一点痕迹
      </button>
    );
  }

  const shouldClamp = phase === 'fading' && !open;

  return (
    <div className="mt-6 border-l border-stone-800/80 pl-4">
      <div className="flex items-start justify-between gap-4">
        <p
          className={
            (shouldClamp ? 'line-clamp-1 ' : '') +
            'text-[12px] font-light leading-7 tracking-[0.06em] text-stone-500 transition-opacity duration-700 ' +
            (phase === 'fresh' ? 'opacity-70' : phase === 'fading' ? 'opacity-45' : 'opacity-35')
          }
        >
          {content}
        </p>
        {(phase === 'fading' || phase === 'folded') && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 border-b border-dashed border-stone-800 pb-1 text-[10px] tracking-[0.14em] text-stone-600 transition-colors duration-500 hover:border-stone-500 hover:text-stone-400"
          >
            {open ? '合上' : '展开'}
          </button>
        )}
      </div>
    </div>
  );
}