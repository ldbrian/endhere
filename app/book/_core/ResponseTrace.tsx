'use client';

import { useMemo, useState } from 'react';

type ResponsePhase = 'present' | 'fading' | 'trace';

function getDaysSince(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
}

function getResponsePhase(createdAt: string): ResponsePhase {
  const days = getDaysSince(createdAt);
  if (days < 30) return 'present';
  if (days < 180) return 'fading';
  return 'trace';
}

export function ResponseTrace({ text, createdAt }: { text: string; createdAt: string }) {
  const [open, setOpen] = useState(false);
  const content = text.trim();
  const phase = useMemo(() => getResponsePhase(createdAt), [createdAt]);

  if (!content) return null;

  if (phase === 'trace' && !open) {
    return (
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-b border-dashed border-stone-700 pb-1 text-left text-[10px] tracking-[0.16em] text-stone-600 transition-colors duration-500 hover:border-stone-500 hover:text-stone-400"
        >
          曾被接住
        </button>
      </div>
    );
  }

  const isFading = phase === 'fading';
  const isTrace = phase === 'trace';
  const shouldClamp = isFading && !open;

  return (
    <div className={(isTrace ? 'mt-5' : 'mt-7') + ' border-l border-stone-800/80 pl-4'}>
      <div className="flex items-start justify-between gap-4">
        <p
          className={
            (shouldClamp ? 'line-clamp-1 ' : '') +
            'text-[12px] font-light leading-7 tracking-[0.06em] text-stone-400 transition-opacity duration-700 ' +
            (phase === 'present' ? 'opacity-70' : phase === 'fading' ? 'opacity-45' : 'opacity-35')
          }
        >
          {content}
        </p>
        {(isFading || isTrace) && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 border-b border-dashed border-stone-800 pb-1 text-[10px] tracking-[0.14em] text-stone-600 transition-colors duration-500 hover:border-stone-500 hover:text-stone-400"
          >
            {open ? '收起' : '旁白'}
          </button>
        )}
      </div>
    </div>
  );
}