'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useShelterStore } from '../store/useShelterStore';
import { useSpaceStore } from '../store/useSpaceStore';
import type { ShelterEntry } from '../store/useShelterStore';

const MANIFESTO_LINES = [
  '这里收藏的不是答案，而是经历。',
  '帮助你保存人生的体验。',
];

const FALLBACK_FRAGMENTS: PublicFragment[] = [
  {
    id: 'seed-1',
    title: '今天有人留下',
    preview: '希望明年的我，还记得今天的晚霞。',
    full: '希望明年的我，还记得今天的晚霞。不是因为它特别罕见，只是那一刻站在路边，突然觉得今天也算被好好地经过了一次。',
    source: 'system',
  },
  {
    id: 'seed-2',
    title: '今天有人留下',
    preview: '冰箱里剩下半个西瓜，像一件还没过完的夏天。',
    full: '冰箱里剩下半个西瓜，像一件还没过完的夏天。切开的时候没有特别开心，只是突然觉得，原来生活也会自己留下一点甜。',
    source: 'system',
  },
  {
    id: 'seed-3',
    title: '今天有人留下',
    preview: '下雨的时候，楼下便利店的灯好像比平时亮一点。',
    full: '下雨的时候，楼下便利店的灯好像比平时亮一点。没有人说话，只听见收银台边上的塑料袋摩擦，像某种很小的安慰。',
    source: 'system',
  },
];

type PublicFragment = {
  id: string;
  title: string;
  preview: string;
  full: string;
  source: 'local' | 'system';
};

function buildPublicFragments(entries: ShelterEntry[]): PublicFragment[] {
  const localFragments = entries
    .filter((entry) => entry.status !== 'incinerated' && entry.content?.trim())
    .slice(0, 12)
    .map((entry) => {
      const content = entry.content.trim().replace(/\s+/g, ' ');
      const preview = content.length > 28 ? `${content.slice(0, 28)}...` : content;

      return {
        id: String(entry.id),
        title: '今天有人留下',
        preview,
        full: content,
        source: 'local' as const,
      };
    });

  return localFragments.length > 0 ? localFragments : FALLBACK_FRAGMENTS;
}

export default function V2HomePage() {
  const entries = useShelterStore((state) => state.entries);
  const setScene = useSpaceStore((state) => state.setScene);

  const fragments = useMemo(() => buildPublicFragments(entries), [entries]);
  const [fragmentIndex, setFragmentIndex] = useState(0);
  const [showFullFragment, setShowFullFragment] = useState(false);

  const currentFragment = fragments[fragmentIndex % fragments.length];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080808] text-zinc-200 selection:bg-zinc-800 selection:text-zinc-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(164,116,70,0.12),transparent_32%),radial-gradient(circle_at_bottom,rgba(133,98,57,0.08),transparent_28%)]" />
      <div className="absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '120px 120px' }} />

      <div className="absolute left-6 top-7 z-20 flex items-center gap-3 opacity-75 md:left-12">
        <img src="/logo.png" alt="End Here Logo" className="h-5 w-5 object-contain" />
        <span className="text-[11px] tracking-[0.24em] text-zinc-500">END HERE</span>
      </div>

      <div className="absolute inset-x-8 bottom-14 z-0 h-px bg-gradient-to-r from-transparent via-amber-900/30 to-transparent md:inset-x-20" />
      <div className="absolute bottom-14 right-10 z-0 h-24 w-24 rounded-full bg-amber-900/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 z-0 h-52 w-52 bg-[linear-gradient(180deg,transparent_0%,rgba(136,96,58,0.06)_100%)] [clip-path:polygon(30%_0%,100%_0%,100%_100%,0%_100%)]" />
      <div className="absolute bottom-10 right-8 z-0 hidden h-44 w-28 rounded-t-[2px] border border-zinc-900/60 bg-white/[0.015] shadow-[inset_0_0_30px_rgba(255,255,255,0.02)] md:block" />
      <div className="absolute bottom-[176px] right-[72px] z-0 hidden h-16 w-10 rounded-full bg-amber-900/10 blur-2xl md:block" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-14 pt-24 md:px-12 md:pt-28">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="mb-6 inline-flex items-center gap-3 rounded-full border border-zinc-800/80 bg-zinc-950/60 px-4 py-2 text-[10px] tracking-[0.26em] text-zinc-500"
          >
            <span className="h-2 w-2 rounded-full bg-amber-700/80" />
            人生体验碎片收藏馆
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.08 }}
            className="max-w-[16em] text-[28px] font-light leading-[1.7] tracking-[0.08em] text-zinc-100 md:text-[40px]"
          >
            {MANIFESTO_LINES.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.18 }}
            className="mt-6 max-w-xl text-[13px] leading-7 tracking-[0.08em] text-zinc-500 md:text-[14px]"
          >
            情绪、回忆、旧物、想法、观点、故事、生活片段，都可以留在这里。
          </motion.p>
        </section>

        <section className="mx-auto mt-14 flex w-full max-w-3xl flex-1 flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
            className="relative w-full overflow-hidden border border-zinc-900/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-7 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:px-10 md:py-10"
          >
            <div className="mb-7 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] tracking-[0.28em] text-zinc-600">{currentFragment.title}</p>
                <p className="mt-2 text-[10px] tracking-[0.22em] text-zinc-700">
                  {currentFragment.source === 'local' ? '馆内碎片' : '店里预置碎片'}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowFullFragment(false);
                  setFragmentIndex((prev) => (prev + 1) % fragments.length);
                }}
                className="text-[10px] tracking-[0.22em] text-zinc-600 transition-colors duration-500 hover:text-zinc-300"
              >
                换一条看看
              </button>
            </div>

            <button
              onClick={() => setShowFullFragment((prev) => !prev)}
              className="group block w-full text-left outline-none"
            >
              <div className="border-l border-amber-900/30 pl-5 md:pl-6">
                <p className="text-[22px] font-light leading-[1.9] tracking-[0.08em] text-zinc-100 md:text-[28px]">
                  “{showFullFragment ? currentFragment.full : currentFragment.preview}”
                </p>
              </div>

              <p className="mt-7 text-[10px] tracking-[0.24em] text-zinc-600 transition-colors duration-500 group-hover:text-zinc-400">
                {showFullFragment ? '收起这一条' : '点开看看完整内容'}
              </p>
            </button>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.24 }}
            onClick={() => setScene('speaking')}
            className="mt-12 rounded-full border border-amber-900/40 bg-amber-950/20 px-8 py-4 text-[14px] tracking-[0.18em] text-zinc-100 shadow-[0_0_50px_rgba(110,72,35,0.18)] transition-all duration-500 hover:border-amber-700/50 hover:bg-amber-950/30"
          >
            留下一个碎片
          </motion.button>
        </section>

        <section className="mt-16 flex flex-col items-center gap-5 text-[12px] tracking-[0.16em] text-zinc-600 md:flex-row md:justify-center md:gap-10">
          <button onClick={() => setScene('nostalgia')} className="transition-colors duration-500 hover:text-zinc-300">
            我的痕迹
          </button>
          <button onClick={() => setScene('mirror')} className="transition-colors duration-500 hover:text-zinc-300">
            照照镜子
          </button>
          <button onClick={() => setScene('resting')} className="transition-colors duration-500 hover:text-zinc-300">
            发呆区
          </button>
          <button onClick={() => setScene('roaming')} className="transition-colors duration-500 hover:text-zinc-300">
            漫游区
          </button>
          <button onClick={() => setScene('shopkeeper')} className="transition-colors duration-500 hover:text-zinc-300">
            店长胶囊历史
          </button>
        </section>
      </div>
    </main>
  );
}
