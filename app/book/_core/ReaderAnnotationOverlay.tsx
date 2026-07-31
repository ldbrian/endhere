'use client';

// ReaderAnnotationOverlay —— 读者批注
// 陌生用户翻完书之后的页边批注。不接 AI，不生成标题，不分析。
// 批注被「人」读：落 reader_annotations 表，店长在 Supabase 里直接看。

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { track } from './analytics';

export const READER_ANNOTATION_DONE_KEY = 'eh_reader_annotation_done';

const DEVICE_ID_KEY = 'eh_device_id';

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

const CloseIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={className}>
    <path d="M10 10H4V4" strokeLinecap="square" />
    <path d="M14 10h6V4" strokeLinecap="square" />
    <path d="M10 14H4v6" strokeLinecap="square" />
    <path d="M14 14h6v6" strokeLinecap="square" />
    <path d="M4 4l6 6" strokeLinecap="square" />
    <path d="M20 4l-6 6" strokeLinecap="square" />
    <path d="M4 20l6-6" strokeLinecap="square" />
    <path d="M20 20l-6-6" strokeLinecap="square" />
  </svg>
);

type Phase = 'idle' | 'sending' | 'done';

export function ReaderAnnotationOverlay({ onClose, onSubmitted }: { onClose: () => void; onSubmitted?: () => void }) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const t1 = window.setTimeout(() => inputRef.current?.focus(), 200);
    const t2 = window.setTimeout(() => inputRef.current?.focus(), 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const canSubmit = text.trim().length > 0 && phase === 'idle';

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || phase !== 'idle') return;
    setPhase('sending');
    try {
      const response = await fetch('/api/book/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          device_id: getDeviceId(),
          source_path: window.location.pathname,
        }),
      });
      track('v5_reader_annotation_submitted', { ok: response.ok });
      if (response.ok) {
        try {
          window.localStorage.setItem(READER_ANNOTATION_DONE_KEY, '1');
        } catch {
          // 存储不可用不阻断：角标最多多亮一次
        }
        setPhase('done');
        onSubmitted?.();
        track('v5_reader_annotation_received', {});
      } else {
        setPhase('idle');
      }
    } catch {
      setPhase('idle');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-5 py-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 12 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-full max-h-[86vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[6px] border border-[#6b5439]/50 bg-[linear-gradient(180deg,#2a221a_0%,#1c1612_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 纸张质感 */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(217,180,120,0.07),transparent_45%),linear-gradient(180deg,rgba(210,175,120,0.04),transparent_20%,transparent_80%,rgba(0,0,0,0.22))]" />
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.6%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.03%22/%3E%3C/svg%3E')] opacity-40" />
        <div className="pointer-events-none absolute inset-[10px] border border-[#7b5d3d]/16" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/10 hover:text-stone-100 cursor-pointer"
          aria-label="收起"
        >
          <CloseIcon className="h-[16px] w-[16px]" />
        </button>

        <div className="relative z-10 flex h-full cursor-default flex-col overflow-y-auto px-8 pb-14 pt-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {phase === 'done' ? (
            <div className="flex h-full flex-col justify-center">
              <p className="text-center text-[9px] tracking-[0.32em] text-stone-500/60">READER&apos;S NOTE</p>
              <p className="mt-8 whitespace-pre-wrap text-[14px] font-light leading-[2] tracking-[0.04em] text-stone-300/85">
                {text}
              </p>
              <p className="mt-8 text-center text-[12px] font-light leading-6 tracking-[0.06em] text-stone-400/80">
                谢谢你。这一页批注，被收进了书里。
              </p>
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[11px] font-light tracking-[0.14em] text-stone-500/50 transition-colors hover:text-stone-300/70 cursor-pointer"
                >
                  合上 →
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-10 text-center">
                <p className="text-[9px] tracking-[0.32em] text-stone-500/60">READER&apos;S NOTE</p>
                <h1 className="mt-3 text-[15px] font-light tracking-[0.16em] text-stone-300">留下一页批注</h1>
              </div>

              <p className="mx-auto max-w-[24em] text-center text-[12px] font-light leading-7 tracking-[0.05em] text-stone-400/80">
                每一本书，都会留下读者的批注。这里也一样。
              </p>
              <p className="mt-3 text-center text-[12px] font-light leading-7 tracking-[0.05em] text-stone-500/60">
                翻开这几页之后，你有什么感受？
              </p>

              <div className="mt-10 flex-1">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={6}
                  className="h-full min-h-[140px] w-full resize-none border-b border-stone-700/30 bg-transparent text-[14px] font-light leading-[2] tracking-[0.04em] outline-none caret-stone-300 text-stone-300 placeholder:text-stone-600/35"
                  placeholder="写在这里…"
                />
              </div>

              <div className="mt-8 shrink-0 text-center">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`self-center rounded-full border px-5 py-1.5 text-[12px] tracking-[0.16em] transition-all duration-300 cursor-pointer ${
                    canSubmit
                      ? 'border-[#c9a86c]/40 bg-[linear-gradient(180deg,rgba(237,202,148,0.12),rgba(180,140,80,0.04))] text-[#ecd9b0] shadow-[0_0_16px_rgba(237,202,148,0.18)] hover:border-[#ecd9b0]/60 hover:shadow-[0_0_28px_rgba(237,202,148,0.32)]'
                      : 'border-stone-700/25 text-stone-600/40 cursor-not-allowed'
                  }`}
                >
                  {phase === 'sending' ? '…' : '落笔'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
