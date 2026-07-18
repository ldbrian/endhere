// ============================================================
// 🟢 Artifact 线稿路由：根据 artifact.name 关键词选择线稿
// 默认 fallback → PaperLine（揉皱的纸/票）
// 老碎片（无 artifact）不渲染，由调用方判断
// ============================================================

import type { FragmentArtifact } from '../fragments';
import {
  PaperLine,
  UmbrellaLine,
  TicketLine,
  KeyLine,
  CupLine,
  NotebookLine,
  LeafLine,
  NoteLine,
  BatteryLine,
  BearLine,
  PhotoLine,
  HeadphoneLine,
  PenLine,
  BoxLine,
} from './ArtifactLineArt';

type LineArtComponent = (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;

// 关键词 → 线稿组件（按 name 命中，顺序敏感，先命中先用）
const ARTIFACT_RULES: { keywords: string[]; Comp: LineArtComponent }[] = [
  { keywords: ['雨伞', '伞', 'umbrella'], Comp: UmbrellaLine },
  { keywords: ['车票', '门票', '票', 'ticket'], Comp: TicketLine },
  { keywords: ['钥匙', 'key'], Comp: KeyLine },
  { keywords: ['咖啡', '杯子', '杯', 'coffee', 'cup'], Comp: CupLine },
  { keywords: ['笔记本', '本子', 'notebook'], Comp: NotebookLine },
  { keywords: ['树叶', '叶子', 'leaf'], Comp: LeafLine },
  { keywords: ['便签', '便利贴', 'note', '便条'], Comp: NoteLine },
  { keywords: ['电池', 'battery'], Comp: BatteryLine },
  { keywords: ['玩具', '熊', 'bear', '娃娃'], Comp: BearLine },
  { keywords: ['照片', 'photo', 'picture'], Comp: PhotoLine },
  { keywords: ['耳机', 'headphone', '耳塞'], Comp: HeadphoneLine },
  { keywords: ['笔', 'pen', '签字'], Comp: PenLine },
  { keywords: ['纸箱', '箱子', 'box'], Comp: BoxLine },
  { keywords: ['纸', '导航', '小票', '收银', '停车票', 'paper'], Comp: PaperLine },
];

export function pickArtifactLineArt(artifact: FragmentArtifact): LineArtComponent {
  const name = artifact.name.toLowerCase();
  for (const rule of ARTIFACT_RULES) {
    if (rule.keywords.some((kw) => name.includes(kw.toLowerCase()))) return rule.Comp;
  }
  return PaperLine;
}

export type { LineArtComponent };
export { PaperLine as FallbackArtifactLine };
