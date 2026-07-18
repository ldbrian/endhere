'use client';

// Mirror 已经形成的重要书签 —— 进度线上的金色刻痕。
// 它们不是当前页，而是 Mirror 识别出的「认识刻痕」。
// marks 存放 0~1 的百分比，例如 [0.28, 0.62]。
// 目前为预留接口，Home 传 []；以后 Mirror 返回 bookmark 时直接映射即可。

export function MirrorMarks({ marks }: { marks: number[] }) {
  if (marks.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {marks.map((mark, index) => {
        const leftPercent = (Math.max(0, Math.min(1, mark)) * 100).toFixed(3) + '%';
        return (
          <span
            key={index}
            style={{ left: leftPercent }}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] leading-none text-[#c9a86a] drop-shadow-[0_0_4px_rgba(245,200,66,0.45)]"
          >
            ✦
          </span>
        );
      })}
    </div>
  );
}
