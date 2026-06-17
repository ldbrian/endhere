'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useFragmentStore } from '../_core/storage';

export default function V2MirrorPage() {
  const localFragments = useFragmentStore((state) => state.localFragments);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);

  // 🟢 CTO 算法：捞取“现在”与“过去”
  const { currentFragment, pastFragment, timeGapDays } = useMemo(() => {
    if (localFragments.length < 2) {
      return { currentFragment: null, pastFragment: null, timeGapDays: 0 };
    }

    // 按时间降序（最新到最老）
    const sorted = [...localFragments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const latest = sorted[0];
    let past = sorted[sorted.length - 1]; // 默认取最老的

    // 尝试找跨度超过 30 天的
    const latestTime = new Date(latest.created_at).getTime();
    for (let i = 1; i < sorted.length; i++) {
      const pastTime = new Date(sorted[i].created_at).getTime();
      const gap = (latestTime - pastTime) / (1000 * 60 * 60 * 24);
      if (gap >= 30) {
        past = sorted[i];
        break;
      }
    }

    const gapDays = Math.floor((latestTime - new Date(past.created_at).getTime()) / (1000 * 60 * 60 * 24));

    return { currentFragment: latest, pastFragment: past, timeGapDays: gapDays };
  }, [localFragments]);

  if (!hasHydrated) return <div className="fixed inset-0 bg-[#080808]" />;

  // 兜底防御：如果不满2条，直接退回
  if (!currentFragment || !pastFragment) {
    return (
      <main className="fixed inset-0 z-50 flex items-center justify-center bg-[#080808]">
        <Link href="/v2/nostalgia" className="text-[11px] tracking-[0.2em] text-zinc-600 transition-colors hover:text-zinc-300">
          [ 痕迹不足，无法成像。点击返回 ]
        </Link>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center bg-[#050505] text-zinc-200 selection:bg-zinc-800 selection:text-zinc-100 font-mono">
      
      {/* 极暗背景光晕 */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.015),transparent_60%)]" />

      {/* 退出按钮 */}
      <Link
        href="/v2/nostalgia"
        className="absolute left-8 top-10 z-50 text-[10px] tracking-[0.3em] text-zinc-700 transition-colors duration-500 hover:text-zinc-400 outline-none"
      >
        返回
      </Link>

      <div className="relative z-10 flex h-full w-full max-w-[430px] flex-col">
        
        {/* 🟢 上半屏：过去的碎片 (THEN) */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, delay: 0.5 }}
          className="flex flex-1 flex-col justify-end px-8 pb-12 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex flex-col items-center text-center opacity-40 hover:opacity-80 transition-opacity duration-1000">
            <span className="mb-6 text-[10px] tracking-[0.3em] text-zinc-500">
              THEN / {new Date(pastFragment.created_at).toLocaleDateString().replace(/\//g, '.')}
            </span>
            <p className="whitespace-pre-wrap text-[13px] font-light leading-[2] tracking-[0.1em] text-zinc-400">
              {pastFragment.original_content}
            </p>
          </div>
        </motion.div>

        {/* 🟢 物理中心轴：时间的镜面 */}
        <div className="relative flex w-full shrink-0 items-center justify-center h-[2px]">
          <motion.div 
            initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: 2, ease: "easeInOut" }}
            className="absolute h-px w-[80%] bg-gradient-to-r from-transparent via-zinc-600/50 to-transparent" 
          />
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 2 }}
            className="absolute bg-[#050505] px-4 text-[9px] tracking-[0.4em] text-zinc-600"
          >
            {timeGapDays === 0 ? 'SAME DAY' : `${timeGapDays} DAYS APART`}
          </motion.div>
        </div>

        {/* 🟢 下半屏：现在的碎片 (NOW) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, delay: 1 }}
          className="flex flex-1 flex-col justify-start px-8 pt-12 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex flex-col items-center text-center">
            <p className="whitespace-pre-wrap text-[14px] font-light leading-[2] tracking-[0.1em] text-zinc-200">
              {currentFragment.original_content}
            </p>
            <span className="mt-6 text-[10px] tracking-[0.3em] text-zinc-600">
              NOW / {new Date(currentFragment.created_at).toLocaleDateString().replace(/\//g, '.')}
            </span>
          </div>
        </motion.div>

      </div>
    </main>
  );
}