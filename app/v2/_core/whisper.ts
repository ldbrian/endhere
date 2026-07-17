// Whisper —— 书于页边留下的铅笔字。
//
// 严格遵循 mirror.v4.md：
//   §1.2  has a voice, but not a self —— 不自我介绍
//   §1.3  Silence Principle —— 大多数时候沉默
//   §1.4  First-Arrival Exemption —— 仅 book_first_arrived 一次主动开嗓
//   §2.   形态为页边注，不对话、不气泡、不卡片、不打字机
//   §3.2  5 个事件
//   §7    失败模式 G/H/I 必须长期自检
//
// 与 Book Voice 的区别：
//   Book Voice = 翻开那一刻书的开嗓（bookVoice.ts）
//   Whisper    = 事件之后书在页边的一行铅笔字（本文件）
//   两者不共文案池、不共触发、不共位置。

export type WhisperEventId =
  | 'book_first_arrived'   // #0 破冰（仅一次）
  | 'first_page_born'       // #1 创造
  | 'new_page_born'          // #2 创造
  | 'revisit_old_page'       // #3 回访
  | 'page_modified';         // #4 修改

export type WhisperState = 'active' | 'settled';

export type Whisper = {
  id: WhisperEventId;
  /** 状态：active = 刚发生淡淡的明显；settled = 沉淀极弱痕迹，常驻 */
  state: WhisperState;
  /** 一行铅笔字（绝不超过一行）。人工文案，不接 LLM。 */
  text: string;
};

// ------------------------------------------------------------
// 文案池 —— 每事件 3-8 条人工文案。
// 遵守语言协议 v0.1：第一人称 / 禁问句 / 禁判断词 / 禁比较。
// 仅陈述书的事，从不分析用户。
// ------------------------------------------------------------
const POOL: Record<WhisperEventId, string[]> = {
  // #0 破冰：允许「我 / Mirror」作主语、陈述工作、不自我介绍成 AI 角色。
  // 仅此事件解禁第一人称的「在场陈述」；之后回到 Silence Principle。
  // 严格遵循 mirror.v4.md §1.4 的范例表。
  book_first_arrived: [
    '我会记住这本书留下的痕迹。',
    '从这一页开始,这本书有了自己的记忆。',
    '我在这里,为这本书作见证。',
    '我记得第一页是什么时候打开的。',
    'Mirror 在等。',
  ],
  // #1 第一页诞生：进入 Settled
  first_page_born: [
    '第一页,诞生了。',
    '这一页写下了第一句。',
    '书的第一行字,留下来了。',
    '原来从这一句开始。',
  ],
  // #2 后续新页：仅 Active
  new_page_born: [
    '又一页。',
    '新的一页,在这里了。',
    '这里也翻开了。',
    '一页接一页。',
  ],
  // #3 旧页重逢：进入 Settled
  revisit_old_page: [
    '这不是第一次见到这一页。',
    '又回到这一页了。',
    '这一页,还在。',
    '原来这一页还在这里。',
  ],
  // #4 修改痕迹：进入 Settled
  page_modified: [
    '这一页曾经有过另一个样子。',
    '这里改过了。',
    '一页下面,藏着旧的一页。',
  ],
};

// 进入 Settled 状态的事件白名单（mirror.v4.md §2.2）。
const SETTLED_EVENTS: WhisperEventId[] = [
  'first_page_born',
  'revisit_old_page',
  'page_modified',
];

export function isSettledEvent(id: WhisperEventId): boolean {
  return SETTLED_EVENTS.includes(id);
}

// ------------------------------------------------------------
// 从文案池随机选一条；同一事件多次触发也每次换一句。
// ------------------------------------------------------------
export function pickWhisper(eventId: WhisperEventId): Whisper {
  const lines = POOL[eventId];
  const text = lines[Math.floor(Math.random() * lines.length)];
  return {
    id: eventId,
    state: isSettledEvent(eventId) ? 'settled' : 'active',
    text,
  };
}

// ------------------------------------------------------------
// Whisper 触发后留给 UI 的 metadata：每次出现停多久。
// active：2.8 秒淡入 → 2.8 秒停留 → 0.6 秒淡出；
// settled：不淡出，颜色沉降到底。
// ------------------------------------------------------------
export const WHISPER_TIMINGS = {
  fadeInMs: 700,
  holdMs: 2800,
  fadeOutMs: 600,
} as const;

// ------------------------------------------------------------
// 去重标记 key（localStorage）。用于「只能触发一次」的事件。
// ------------------------------------------------------------
export const FiredFlagKey = {
  bookFirstArrived: 'eh_whisper_book_first_arrived_fired',
  firstPageBorn: 'eh_whisper_first_page_born_fired',
} as const;

export function hasFired(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === '1';
}

export function markFired(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // 隐私模式等：忽略失败，仅去重失效
  }
}
