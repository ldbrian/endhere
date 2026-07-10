'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from '../_core/analytics';
import { useFragmentStore } from '../_core/storage';
import { MirrorTopicPanel } from '../_core/MirrorTopicPanel';

const MIRROR_LEVELS = [5, 10, 20, 40, 60] as const;

function getMirrorLevel(completedPages: number) {
  let level = 0;
  let nextThreshold = MIRROR_LEVELS[0];
  for (let i = 0; i < MIRROR_LEVELS.length; i++) {
    if (completedPages >= MIRROR_LEVELS[i]) {
      level = i + 1;
      nextThreshold = MIRROR_LEVELS[i + 1] ?? MIRROR_LEVELS[i];
    } else {
      nextThreshold = MIRROR_LEVELS[i];
      break;
    }
  }
  const currentThreshold = level > 0 ? MIRROR_LEVELS[level - 1] : 0;
  return { level, currentThreshold, nextThreshold };
}

export default function V2MirrorPage() {
  const { book, mirrorViewedAt, markMirrorViewed, _hasHydrated: hasHydrated } = useFragmentStore();
  const completedPageCount = useMemo(() => book.pages.filter((page) => page.paragraphs.length > 0).length, [book.pages]);
  const isMirrorReady = completedPageCount >= MIRROR_LEVELS[0];
  const remainingPages = Math.max(0, MIRROR_LEVELS[0] - completedPageCount);
  const mirrorLevel = useMemo(() => getMirrorLevel(completedPageCount), [completedPageCount]);

  // Mark mirror as viewed when entering the page and mirror is ready
  useEffect(() => {
    if (hasHydrated && isMirrorReady) {
      markMirrorViewed();
      track('v4_mirror_viewed', { completedPageCount });
    }
  }, [hasHydrated, isMirrorReady, markMirrorViewed]);

  if (!hasHydrated) {
    return (
      <main className="min-h-dvh bg-[#120f0e]">
        <div className="flex h-dvh items-center justify-center">
          <p className="text-[11px] tracking-[0.18em] text-stone-600">加载中…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#120f0e] text-stone-100 selection:bg-stone-700 selection:text-stone-50">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_34%)]" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 py-6">
        {/* Header */}
        <header className="shrink-0 border-b border-stone-800/40 pb-5">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/v2"
              className="border-b border-dashed border-stone-700/60 pb-0.5 text-[11px] tracking-[0.18em] text-stone-500 transition-colors duration-500 hover:border-stone-400 hover:text-stone-200"
              onClick={() => track('v4_mirror_back_to_book_tap')}
            >
              ← 回到书里
            </Link>
            <span className="font-mono text-[10px] tracking-[0.26em] text-stone-600/60">MIRROR</span>
          </div>
        </header>

        {/* Content */}
        <section className="min-h-0 flex-1 pt-6">
          <AnimatePresence mode="wait">
            {!isMirrorReady ? (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex h-full flex-col justify-center py-16"
              >
                {/* Progress illustration — book pages stacking */}
                <div className="mx-auto mb-10 flex items-end gap-[3px]">
                  {Array.from({ length: MIRROR_LEVELS[0] }).map((_, index) => (
                    <motion.div
                      key={index}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
                      className={`w-[14px] origin-bottom rounded-[2px] transition-colors duration-500 ${
                        index < completedPageCount
                          ? 'bg-[#8b6b45]/70 h-[48px]'
                          : 'bg-stone-700/30 h-[32px]'
                      }`}
                    />
                  ))}
                </div>

                {/* Progress text */}
                <div className="text-center">
                  <p className="text-[15px] font-light leading-[2] tracking-[0.1em] text-stone-300/80">
                    这本书正在慢慢认识你。
                  </p>
                  <p className="mt-3 text-[13px] font-light leading-[2] tracking-[0.06em] text-stone-500/70">
                    再写 {remainingPages} 页，它会第一次尝试找出这些页之间的联系。
                  </p>
                  {/* Numeric progress */}
                  <div className="mt-8 flex items-center justify-center gap-3">
                    <span className="font-mono text-[20px] tracking-[0.12em] text-stone-300/60">{completedPageCount}</span>
                    <span className="font-mono text-[12px] tracking-[0.2em] text-stone-600/50">/</span>
                    <span className="font-mono text-[12px] tracking-[0.2em] text-stone-600/50">{MIRROR_LEVELS[0]}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mx-auto mt-4 h-[2px] w-[120px] overflow-hidden rounded-full bg-stone-800/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedPageCount / MIRROR_LEVELS[0]) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-[#8b6b45]/60"
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="mirror"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <MirrorTopicPanel embedded />
                {/* Level progress */}
                <div className="mt-8 border-t border-stone-800/30 pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-[0.16em] text-stone-500/50">下一层</span>
                    <span className="font-mono text-[11px] tracking-[0.14em] text-stone-400/60">{completedPageCount} / {mirrorLevel.nextThreshold}</span>
                  </div>
                  <div className="mt-2.5 h-[2px] w-full overflow-hidden rounded-full bg-stone-800/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (completedPageCount / mirrorLevel.nextThreshold) * 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-[#8b6b45]/50"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {MIRROR_LEVELS.map((threshold, index) => (
                      <div key={threshold} className="flex flex-col items-center gap-1">
                        <span className={`h-[5px] w-[5px] rounded-full transition-colors duration-500 ${index < mirrorLevel.level ? 'bg-[#8b6b45]/70' : 'bg-stone-700/30'}`} />
                        <span className={`font-mono text-[8px] tracking-[0.12em] ${index < mirrorLevel.level ? 'text-stone-400/60' : 'text-stone-600/35'}`}>{threshold}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}