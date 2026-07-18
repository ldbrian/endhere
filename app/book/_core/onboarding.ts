// V5 首页 Onboarding —— 001 页五选项引导。
// 出现条件仅 page.page_number === '001' 且该页空白、可写。
// 严格遵循 constitution.md §3 第一段 Q + ADR-003 D5 + 你 V5 文档全文:
//   - 主标题:大字「写下今天想说的，或想找到答案的」(V5 Addendum 双轨)
//   - 视觉层级:主标题 → 一句辅 → 五入口
//   - 五入口是「翻阅方向」而不是「功能菜单」:不放右侧箭头、不放按钮感、纯书页气质
//   - 选定后顶部换成对应展开引导(两行:慢叙述 + 推问),
//     不直接回答、不一步展开 —— 你 V5 §5 明确要求

export type QuestionOption = {
  id: string;
  /** 选项在主屏的名称 —— 不带分类感、像书提供的几条门路 */
  label: string;
  /** 用户点了之后,顶部换成的两行展开引导(慢叙述 + 推问) */
  openingA: string;
  openingB: string;
};

export const FIRST_PAGE_QUESTION_OPTIONS: QuestionOption[] = [
  {
    id: 'vexing_problem',
    label: '有个问题困扰着我',
    openingA: '慢慢告诉我，是什么在困扰你？',
    openingB: '它从什么时候开始一直留在你心里？',
  },
];

export const FREEWRITE_OPTION_ID = 'freewrite';

// 非 001 页统一双轨书提问——每页只问一件事:
// 「今天有什么想说的或有什么想问的」
// 弱化、小字、不抢戏,遵循 V5 「Less AI, More Book」精神
export const BOOK_DUAL_TRACK_PROMPT = '今天有什么想说的或有什么想问的';
