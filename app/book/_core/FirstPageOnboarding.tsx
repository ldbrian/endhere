'use client';

// FirstPageOnboarding —— V5 Addendum 简化版 001 新手引导
// 只给两个选择:「最近有什么事情让你想不明白？」或「写下最近发生的一件事」
// 标题克制,CTA 不挤到滚动条外

import { motion } from 'framer-motion';
import { FIRST_PAGE_QUESTION_OPTIONS, FREEWRITE_OPTION_ID } from './onboarding';

type Props = {
  onPick: (option: { id: string; openingA: string; openingB: string }) => void;
};

export function FirstPageOnboarding({ onPick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col justify-center px-4"
    >
      {/* ── 标题 —— 适中字号，不挤占空间 ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <h1 className="font-serif text-[20px] font-light leading-[1.5] tracking-[0.04em] text-stone-100">
          这是你的第一页，
          <br />
          今天想从哪里开始？
        </h1>
      </motion.div>

      {/* ── 两个选择 ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="mt-10 flex flex-col items-center gap-5"
      >
        {FIRST_PAGE_QUESTION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick({ id: opt.id, openingA: opt.openingA, openingB: opt.openingB })}
            className="group flex items-center text-[14px] font-light tracking-[0.08em] text-stone-300/85 transition-all duration-300 hover:text-stone-100 cursor-pointer"
          >
            <span className="mr-3 text-stone-600/40 transition-colors group-hover:text-stone-400/60">·</span>
            {opt.label}
            <span className="ml-2 inline-block text-[#c9a86c]/85 transition-all duration-300 group-hover:ml-3 group-hover:text-[#c9a86c]">→</span>
          </button>
        ))}
      </motion.div>

      {/* ── 「写下最近发生的一件事」= 自由书写 ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.45 }}
        className="mt-5 text-center"
      >
        <button
          type="button"
          onClick={() => onPick({ id: FREEWRITE_OPTION_ID, openingA: '', openingB: '' })}
          className="group flex items-center text-[14px] font-light tracking-[0.08em] text-stone-300/85 transition-colors hover:text-stone-100 cursor-pointer"
        >
          <span className="mr-3 text-stone-600/40 transition-colors group-hover:text-stone-400/60">·</span>
          写下最近发生的一件事
          <span className="ml-2 inline-block text-[#c9a86c]/85 transition-all duration-300 group-hover:ml-3 group-hover:text-[#c9a86c]">→</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
