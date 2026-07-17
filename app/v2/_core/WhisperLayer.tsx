'use client';

// WhisperLayer —— 书在页边的一行铅笔字。
// 严格遵循 mirror.v4.md §2：
//   - 极小字号、纸张色 / 灰黑 / 墨迹感（禁 AI 颜色：蓝 / 紫 / 渐变）
//   - 淡入 / 沉淀 / 淡出（不打字机、不逐字）
//   - 不阻挡、不带气泡 / 卡片
//
// 位置：bottom-20（256px 等价区域）—— 避开「写下这一页」按钮，
// Whisper 不再与之重叠。这是 v0.1 修订点 2。
//
// 仅消费一个 Whisper 当前/下一对状态（父组件控制），自己不触发任何事件。
// 同一时间 page 上最多一个 Whisper（mirror.v4.md §7 失败模式 G）。

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Whisper } from './whisper';
import { WHISPER_TIMINGS } from './whisper';

type Props = {
  /** 当前要显示的 Whisper；null 表示不显示。父组件切换此值即驱动浮起 / 淡出。 */
  whisper: Whisper | null;
};

/**
 * 根据事件 + 状态给出最终样式类。
 *
 * 视觉分级（mirror.v4.md §1.4 修订后）：
 *   - book_first_arrived + active: 更明显一档
 *       字号 12px、透明度 /75
 *       —— 破冰必须有存在感，让用户意识到产品里存在一个记忆层
 *   - 其他事件 + active: 原淡墨迹
 *       字号 11px、透明度 /55
 *   - settled（任意事件）: 极弱痕迹，纸张压暗感
 *       字号 11px、透明度 /30
 *
 * 颜色铁律（§2.4）维持：仅 stone 系，绝不使用蓝紫渐变。
 */
function classFor(w: Whisper): { className: string; size: string } {
  if (w.state === 'settled') {
    return {
      className: 'text-stone-600/30',
      size: 'text-[11px]',
    };
  }
  if (w.id === 'book_first_arrived') {
    return {
      className: 'text-stone-400/75',
      size: 'text-[12px]',
    };
  }
  return {
    className: 'text-stone-400/55',
    size: 'text-[11px]',
  };
}

export function WhisperLayer({ whisper }: Props) {
  const [internal, setInternal] = useState<Whisper | null>(whisper);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (whisper !== null) {
      setInternal(whisper);
      setExiting(false);
      return;
    }
    if (internal === null) return;
    setExiting(true);
    const t = window.setTimeout(() => {
      setInternal(null);
      setExiting(false);
    }, WHISPER_TIMINGS.fadeOutMs);
    return () => window.clearTimeout(t);
  }, [whisper, internal]);

  // Active Whisper 自然淡出 —— settled 不淡出（破冰也是 Active-only）
  useEffect(() => {
    if (!internal || internal.state === 'settled' || exiting) return;
    const t = window.setTimeout(() => setExiting(true), WHISPER_TIMINGS.holdMs + WHISPER_TIMINGS.fadeInMs);
    return () => window.clearTimeout(t);
  }, [internal, exiting]);

  const style = internal ? classFor(internal) : null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-10"
    >
      <AnimatePresence>
        {internal && style && !exiting ? (
          <motion.p
            key={`${internal.id}-${internal.text}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: WHISPER_TIMINGS.fadeInMs / 1000,
              ease: 'easeOut',
            }}
            className={`font-mono ${style.size} tracking-[0.24em] ${style.className} select-none`}
          >
            {internal.text}
          </motion.p>
        ) : null}
        {internal && style && exiting ? (
          <motion.p
            key={`${internal.id}-${internal.text}-out`}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{
              duration: WHISPER_TIMINGS.fadeOutMs / 1000,
              ease: 'easeIn',
            }}
            className={`font-mono ${style.size} tracking-[0.24em] ${style.className} select-none`}
          >
            {internal.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
