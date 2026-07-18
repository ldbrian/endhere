// ============================================================
// 🟢 Artifact 单色线稿插画组件库 (V3.2 Bonus)
// 设计原则：统一 stroke="currentColor"，单色、不写实、不彩色
// 所有组件 viewBox="0 0 48 48"，fill=none，可被 currentColor 染色
// ============================================================

type SvgProps = React.SVGProps<SVGSVGElement>;

const BASE_PROPS: SvgProps = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// 🗺️ 揉皱的导航纸 / 停车票 / 收银小票（默认兜底）
export function PaperLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M12 6h24v36l-3-1.8-3 1.8-3-1.8-3 1.8-3-1.8-3 1.8-3-1.8-3 1.8V6z" />
      <path d="M17 14h14M17 19h14M17 24h9" />
    </svg>
  );
}

// ☔ 雨伞
export function UmbrellaLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M6 24a18 18 0 0 1 36 0H6z" />
      <path d="M14 24c0-5 3-9 10-9M34 24c0-5-3-9-10-9" />
      <path d="M24 24v16a3 3 0 0 1-6 0" />
    </svg>
  );
}

// 🎫 车票 / 门票
export function TicketLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M5 16h38v16a3 3 0 0 0 0 6H5a3 3 0 0 0 0-6V16z" />
      <path d="M24 16v22" strokeDasharray="2 2.5" />
      <path d="M11 22h7M11 26h5" />
    </svg>
  );
}

// 🔑 钥匙
export function KeyLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <circle cx="15" cy="18" r="7" />
      <path d="M20 22l20 20M33 35l3-3M37 39l3-3" />
      <circle cx="15" cy="18" r="2.5" />
    </svg>
  );
}

// ☕ 咖啡杯
export function CupLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M11 18h22v12a8 8 0 0 1-8 8H19a8 8 0 0 1-8-8V18z" />
      <path d="M33 21h4a4 4 0 0 1 0 8h-4" />
      <path d="M16 10c-1.5 1.5-1.5 3 0 4.5M22 10c-1.5 1.5-1.5 3 0 4.5M28 10c-1.5 1.5-1.5 3 0 4.5" />
    </svg>
  );
}

// 📓 旧笔记本
export function NotebookLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M13 6h22a2 2 0 0 1 2 2v32a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M18 6v36" />
      <path d="M23 18h8M23 24h8M23 30h5" />
    </svg>
  );
}

// 🍃 树叶
export function LeafLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M10 38c0-16 12-28 28-28 0 16-12 28-28 28z" />
      <path d="M10 38L30 18" />
      <path d="M18 30l6-6M14 34l5-5" />
    </svg>
  );
}

// 📝 便签
export function NoteLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M10 8h22l8 8v24a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
      <path d="M32 8v8h8" />
      <path d="M14 24h16M14 30h16M14 36h10" />
    </svg>
  );
}

// 🔋 电池
export function BatteryLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="8" y="16" width="30" height="16" rx="2" />
      <rect x="38" y="20" width="3" height="8" rx="1" />
      <path d="M16 20v8M22 20v8" />
      <path d="M28 24h4" strokeDasharray="1.5 2" />
    </svg>
  );
}

// 🧸 玩具熊
export function BearLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <circle cx="14" cy="12" r="4" />
      <circle cx="34" cy="12" r="4" />
      <circle cx="24" cy="26" r="14" />
      <circle cx="19" cy="24" r="1.5" fill="currentColor" />
      <circle cx="29" cy="24" r="1.5" fill="currentColor" />
      <path d="M21 30c1 1.5 2 2 3 2s2-0.5 3-2" />
      <path d="M24 32v2" />
    </svg>
  );
}

// 🎞️ 照片
export function PhotoLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="7" y="9" width="34" height="30" rx="2" />
      <circle cx="17" cy="19" r="3" />
      <path d="M7 33l9-8 7 6 8-7 10 9" />
    </svg>
  );
}

// 🎧 耳机
export function HeadphoneLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M9 28a15 15 0 0 1 30 0" />
      <rect x="6" y="27" width="7" height="12" rx="2" />
      <rect x="35" y="27" width="7" height="12" rx="2" />
    </svg>
  );
}

// 🖊️ 笔
export function PenLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M32 8l8 8-22 22-9 1 1-9L32 8z" />
      <path d="M26 14l8 8" />
      <path d="M10 40l-3 3" />
    </svg>
  );
}

// 📦 纸箱
export function BoxLine(props: SvgProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M8 16l16-8 16 8v20l-16 8-16-8V16z" />
      <path d="M8 16l16 8 16-8M24 24v20" />
      <path d="M16 12l16 8" strokeDasharray="2 2.5" />
    </svg>
  );
}
