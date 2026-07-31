'use client';

// FirstPageOnboarding —— V5 Addendum 简化版 001 新手引导
// 两个入口做成「书页索引行」：整行可点，底部点状页线做可点击暗示（书的目录/索引画法），
// 文字左对齐、13px、收紧行内间距以尽量单行；窄屏放不下时优雅换两行。
// 悬停：文字变亮、点状页线转琥珀、箭头右移。

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
      className="flex h-full flex-col justify-center px-2"
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

      {/* ── 两个入口：书页索引行 ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="mt-8"
      >
        {FIRST_PAGE_QUESTION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick({ id: opt.id, openingA: opt.openingA, openingB: opt.openingB })}
            className="group flex w-full items-center border-b border-dashed border-stone-700/55 py-3.5 text-left transition-colors duration-300 hover:border-[#c9a86c]/60 cursor-pointer"
          >
            <span className="mr-2 shrink-0 text-stone-500/50 transition-colors duration-300 group-hover:text-[#c9a86c]/70">·</span>
            <span className="min-w-0 flex-1 text-[13px] font-light leading-[1.85] tracking-[0.08em] text-stone-300/85 transition-colors duration-300 group-hover:text-stone-100">
              {opt.label}
            </span>
            <span className="ml-2 shrink-0 text-[#c9a86c]/85 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#c9a86c]">→</span>
          </button>
        ))}
      </motion.div>

      {/* ── 「写下最近发生的一件事」= 自由书写 ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.45 }}
        className="mt-5"
      >
        <button
          type="button"
          onClick={() => onPick({ id: FREEWRITE_OPTION_ID, openingA: '', openingB: '' })}
          className="group flex w-full items-center border-b border-dashed border-stone-700/55 py-3.5 text-left transition-colors duration-300 hover:border-[#c9a86c]/60 cursor-pointer"
        >
          <span className="mr-2 shrink-0 text-stone-500/50 transition-colors duration-300 group-hover:text-[#c9a86c]/70">·</span>
          <span className="min-w-0 flex-1 text-[13px] font-light leading-[1.85] tracking-[0.08em] text-stone-300/85 transition-colors duration-300 group-hover:text-stone-100">
            写下最近发生的一件事
          </span>
          <span className="ml-2 shrink-0 text-[#c9a86c]/85 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#c9a86c]">→</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
