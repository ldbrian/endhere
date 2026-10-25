// ============================================================
// 十张牌：枚举 + 意象 + 资产契约
// ------------------------------------------------------------
// 依据 docs/authority/2026-10/EH_十张牌意象清单_2026-10-24.md
//
// 牌只是载体、非命理：这里只存**意象**，不存牌意。
// 不写正位／逆位，不写预测；牌意由人格结合用户原话现场生成。
//
// 牌名必须是固定枚举——一页一张牌，牌才有意义。
// 所以模型只能在 CARD_IDS 里选，选不出来就走 fallbackCardId，
// 绝不允许它自由命名（否则一页一个说法，牌就不成立）。
// ============================================================

import type { FragmentPersonaId } from './personas';

export type CardId =
  | 'lamp' // 灯
  | 'mirror' // 镜子
  | 'layer' // 层
  | 'road' // 路
  | 'door' // 门
  | 'bookpage' // 书页
  | 'egg' // 蛋
  | 'tide' // 潮
  | 'window' // 窗
  | 'cup'; // 杯子

export type CardDefinition = {
  id: CardId;
  /** 中文名，落页时显示 */
  name: string;
  /** 意象原句，进 prompt。不写牌意、不写正逆位、不预测 */
  imagery: string;
};

export const CARD_IDS: readonly CardId[] = [
  'lamp',
  'mirror',
  'layer',
  'road',
  'door',
  'bookpage',
  'egg',
  'tide',
  'window',
  'cup',
];

export const CARD_DEFINITIONS: Record<CardId, CardDefinition> = {
  lamp: {
    id: 'lamp',
    name: '灯',
    imagery: '深夜便利店的暖光；照见一小片，不是全世界。',
  },
  mirror: {
    id: 'mirror',
    name: '镜子',
    imagery: '照见你没注意到的那一面。',
  },
  layer: {
    id: 'layer',
    name: '层',
    imagery: '一层一层压上来的东西；积累、叠加。',
  },
  road: {
    id: 'road',
    name: '路',
    imagery: '走过的路、眼前的岔路。',
  },
  door: {
    id: 'door',
    name: '门',
    imagery: '开合、进出、门槛；入口本身。',
  },
  bookpage: {
    id: 'bookpage',
    name: '书页',
    imagery: '写过的页、还没写完的页；回看本身。',
  },
  egg: {
    id: 'egg',
    name: '蛋',
    imagery: '一件小事、一个开始。',
  },
  tide: {
    id: 'tide',
    name: '潮',
    imagery: '涨落；情绪的水位。',
  },
  window: {
    id: 'window',
    name: '窗',
    imagery: '向外看的一格；框住的一小片世界。',
  },
  cup: {
    id: 'cup',
    name: '杯子',
    imagery: '冒热气的东西；被递过来的暖。',
  },
};

export function isCardId(value: unknown): value is CardId {
  return typeof value === 'string' && (CARD_IDS as readonly string[]).includes(value);
}

/**
 * 宽容解析模型给的牌名：英文 id、中文名、大小写不一、带 card_ 前缀都认。
 * 认不出来返回 null，由调用方走 fallbackCardId —— 不报错、不放行。
 */
export function normalizeCardId(value: unknown): CardId | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase().replace(/^card[-_\s]*/, '');
  if (isCardId(lowered)) return lowered;

  for (const id of CARD_IDS) {
    const definition = CARD_DEFINITIONS[id];
    if (definition.name === raw || definition.name === lowered) return id;
  }

  // 模型爱写「灯的意象」这类带后缀的说法，放宽到「以中文名开头」
  for (const id of CARD_IDS) {
    const { name } = CARD_DEFINITIONS[id];
    if (raw.startsWith(name)) return id;
  }

  return null;
}

/**
 * 兜底牌：模型给了枚举外的牌名时用。
 * 取「该人格最先看见的东西」，确定且可解释——不是随机，避免同一段话重试换牌。
 */
const PERSONA_FALLBACK_CARD: Record<FragmentPersonaId, CardId> = {
  Ash: 'layer', // 因果叠加、误差积累
  Rin: 'door', // 关系里的入口与门槛
  Child: 'egg', // 一件小事、一个开始
  Vee: 'tide', // 身体的节奏、涨落
  Sol: 'road', // 路与远方
  Echo: 'cup', // 被留下的物件与温度
};

export function fallbackCardId(persona: FragmentPersonaId): CardId {
  return PERSONA_FALLBACK_CARD[persona] ?? 'bookpage';
}

export function getCardDefinition(id: CardId): CardDefinition {
  return CARD_DEFINITIONS[id];
}

/** 进 prompt 的牌面清单：给名字、给 id、给意象，不给牌意 */
export function describeCardsForPrompt(): string {
  return CARD_IDS.map((id) => {
    const { name, imagery } = CARD_DEFINITIONS[id];
    return `- ${name}（${id}）：${imagery}`;
  }).join('\n');
}

// ── 资产契约 ────────────────────────────────────────────────
// 代码只认这四个路径，换画师只换文件、不动代码。
// 线条版由彩色版做同一画面的去色工序，不重画。
export const CARD_ASSET_DIR = '/cards';

/** 落页插画（彩色，水彩） */
export function cardColorAsset(id: CardId): string {
  return `${CARD_ASSET_DIR}/${id}-color.webp`;
}

/** 翻牌过程中的线条版 */
export function cardLineAsset(id: CardId): string {
  return `${CARD_ASSET_DIR}/${id}-line.webp`;
}

/**
 * 写态占位：中性卡背纹样。
 * 绝不能是某张牌的线条版——那等于提前泄露抽卡结果。
 */
export const CARD_BACK_ASSET = `${CARD_ASSET_DIR}/card-back.webp`;
