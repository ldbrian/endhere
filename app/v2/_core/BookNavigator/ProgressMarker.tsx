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
      className="pointer-events-none absolute top-1/2 z-20 h-[24px] w-[3px] -translate-x-1/2 -translate-y-1/2"
    >
      {/* 主体光柱：上下端淡出，中段圆润发亮。发光用 box-shadow（GPU 合成，
          跟随元素整体移动），不用 blur 滤镜——blur 每帧重算会在动画中产生残影。 */}
      <span
        className="block h-full w-full rounded-full"
        style={{
          background: 'linear-gradient(to bottom, rgba(237,229,218,0) 0%, rgba(237,229,218,0.92) 32%, rgba(245,238,228,1) 50%, rgba(237,229,218,0.92) 68%, rgba(237,229,218,0) 100%)',
          boxShadow: '0 0 6px 1px rgba(237,229,218,0.45)',
        }}
      />
    </motion.span>
  );
}
