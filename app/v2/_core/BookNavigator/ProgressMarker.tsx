'use client';

import { motion } from 'framer-motion';

// 当前阅读位置的标记。绝对定位于进度线上，按百分比平滑移动，
// 不会因为页数变化或父级重渲染而抖动整个轴。
// 一根柔软、圆润的光柱：上下端淡出，中段微暖，像书页间透出的一线光。

export function ProgressMarker({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  const leftPercent = (clamped * 100).toFixed(3) + '%';

  return (
    <motion.span
      aria-hidden="true"
      // 用 animate 驱动 left，让标记随翻页在整条线上平滑滑动。
      animate={{ left: leftPercent }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="pointer-events-none absolute top-1/2 z-20 flex h-[24px] w-[3px] -translate-x-1/2 -translate-y-1/2 items-stretch justify-center"
    >
      {/* 外层柔光：扩散、模糊的光晕 */}
      <span
        className="absolute inset-y-0 left-1/2 w-[10px] -translate-x-1/2 rounded-full blur-[3px]"
        style={{ background: 'radial-gradient(ellipse at center, rgba(237,229,218,0.5) 0%, rgba(237,229,218,0.18) 45%, transparent 75%)' }}
      />
      {/* 主体光柱：上下端淡出，中段圆润发亮 */}
      <span
        className="relative w-full rounded-full"
        style={{
          background: 'linear-gradient(to bottom, rgba(237,229,218,0) 0%, rgba(237,229,218,0.92) 32%, rgba(245,238,228,1) 50%, rgba(237,229,218,0.92) 68%, rgba(237,229,218,0) 100%)',
        }}
      />
    </motion.span>
  );
}
