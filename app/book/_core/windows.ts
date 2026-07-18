// ============================================================
// Windows —— EndHere 的第一位「人格」(产品气质层)
// ------------------------------------------------------------
// 配套文档:_core/prompts.research.md
// 配套宪法:_core/constitution.md 第一层(Expression)
//
// Window 不是问题,不是钩子。
// Window 是产品替用户指出一扇可以重新看见生活的窗。
// 它的说话方式是「观察」,不是「回答」。
//
// 第一阶段:全部 L1(感知层)。
// 判别:Window 的答案必须能从用户直接内省给出,
//        不依赖计数器 / 基线 / 他人视角。
// ============================================================

// ------------------------------------------------------------
// 维度 A:object_type —— 你注意到了什么?(对象)
// 纯多标签,无主次。
// ------------------------------------------------------------
export type ObjectType =
  | '人物'      // 一个人
  | '物品'      // 一个具体的物件
  | '动作'      // 一个行为/动作
  | '一句话'    // 说过/听过/差点说出的一句
  | '声音'      // 一个声响
  | '地点'      // 一个空间位置
  | '气味'      // 一个味道
  | '身体'      // 身体感觉/状态
  | '时间'      // 一个时刻/一段时长
  | '影像'      // 一个画面/视觉印象
  | '泛';       // 不指向具体名词(慎用,尽量落到前 10 类)

// ------------------------------------------------------------
// 维度 B:Sense —— 你是怎么注意到它的?(感官通道)
// 纯多标签。
// ------------------------------------------------------------
export type Sense =
  | '视觉'
  | '听觉'      // 含内在听觉(脑子里响的声音)
  | '触觉'
  | '嗅觉'
  | '味觉'
  | '身体感觉'  // 累/冷/重/紧等身体内感
  | '空间'      // 位置/方向/远近
  | '时间'      // 时长/时刻/节奏
  | '内在';     // 念头/记忆/情绪的内在浮现

// ------------------------------------------------------------
// Window 数据结构(最小可用版,字段纪律见 prompts.research.md §5)
// ------------------------------------------------------------
// 字段纪律:产品先长行为,再长数据结构。
// 没有地方真正用到的字段,不进第一版。
// emotion / season / time_of_day / weight 暂不加,等真实数据长出来。
export type WindowItem = {
  text: string;
  level: 1;              // 第一阶段锁死 L1
  object_type: ObjectType[];
  sense: Sense[];
  language: 'zh' | 'en';
};

// ============================================================
// 40 条 L1 Windows
// ------------------------------------------------------------
// 经过 L1 精修版合规自检:
//  - 无「数」(几次/几遍/两次/三遍)
//  - 无「比基线」(比平时/变慢/变亮)
//  - 无「猜他人」(别人没注意/别人在想)
// 落库前请用 prompts.research.md §2 的判别标准再过一遍。
// ============================================================

export const WINDOWS: WindowItem[] = [
  // ── 原始 40 条(保留核心观察句式) ──
  { text: '今天有没有一个东西,你拿起来很多次?', level: 1, object_type: ['物品', '动作'], sense: ['触觉', '视觉'], language: 'zh' },
  { text: '今天有没有一句话,你差点说出口?', level: 1, object_type: ['一句话'], sense: ['听觉'], language: 'zh' },
  { text: '今天有没有一个地方,让你停了一下?', level: 1, object_type: ['地点'], sense: ['空间'], language: 'zh' },
  { text: '今天有没有一个声音,让你回头?', level: 1, object_type: ['声音'], sense: ['听觉'], language: 'zh' },
  { text: '今天有没有一个味道,突然飘过来?', level: 1, object_type: ['气味'], sense: ['嗅觉'], language: 'zh' },
  { text: '今天有没有一个人,你想了一下但没联系?', level: 1, object_type: ['人物'], sense: ['内在'], language: 'zh' },
  { text: '今天有没有一个东西,你找了半天?', level: 1, object_type: ['物品', '动作'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一瞬,你走神了?', level: 1, object_type: ['时间', '动作'], sense: ['时间'], language: 'zh' },
  { text: '今天有没有一个字,你写错了又擦掉?', level: 1, object_type: ['动作', '物品'], sense: ['视觉', '触觉'], language: 'zh' },
  { text: '今天有没有一段路,你不自觉就走完了?', level: 1, object_type: ['地点', '动作'], sense: ['空间', '身体感觉'], language: 'zh' },
  { text: '今天有没有一个动作,你不知不觉做了很多遍?', level: 1, object_type: ['动作'], sense: ['身体感觉', '触觉'], language: 'zh' },
  { text: '今天有没有一束光,落在你身上?', level: 1, object_type: ['影像', '地点'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一首歌,在你脑子里转?', level: 1, object_type: ['声音'], sense: ['听觉'], language: 'zh' },
  { text: '今天有没有一个温度,让你注意到了?', level: 1, object_type: ['身体'], sense: ['触觉', '身体感觉'], language: 'zh' },
  { text: '今天有没有一个人,对你说了一句意外的话?', level: 1, object_type: ['人物', '一句话'], sense: ['听觉'], language: 'zh' },
  { text: '今天有没有一个东西,你忘了带?', level: 1, object_type: ['物品'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一秒钟,你什么都没想?', level: 1, object_type: ['时间'], sense: ['时间'], language: 'zh' },
  { text: '今天有没有一个画面,你记下来了?', level: 1, object_type: ['影像'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一样食物,吃完了还想?', level: 1, object_type: ['物品'], sense: ['味觉'], language: 'zh' },
  { text: '今天有没有一个角落,你坐了一会儿?', level: 1, object_type: ['地点'], sense: ['空间', '身体感觉'], language: 'zh' },
  { text: '今天有没有一句话,别人说的,你记住了?', level: 1, object_type: ['一句话', '人物'], sense: ['听觉'], language: 'zh' },
  { text: '今天有没有一个东西,你扔了?', level: 1, object_type: ['物品', '动作'], sense: ['视觉', '触觉'], language: 'zh' },
  { text: '今天有没有一种颜色,今天特别多?', level: 1, object_type: ['影像'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一个时间点,你反复去看?', level: 1, object_type: ['时间'], sense: ['时间', '视觉'], language: 'zh' },
  { text: '今天有没有一个表情,你注意到了?', level: 1, object_type: ['人物', '动作'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一个习惯动作,你今天又做了?', level: 1, object_type: ['动作', '身体'], sense: ['身体感觉'], language: 'zh' },
  { text: '今天有没有一个字眼,今天一直在你说的话里?', level: 1, object_type: ['一句话', '声音'], sense: ['听觉'], language: 'zh' },
  { text: '今天有没有一段静默,让你停了一下?', level: 1, object_type: ['声音', '时间'], sense: ['听觉', '时间'], language: 'zh' },
  { text: '今天有没有一个东西,你犹豫要不要买?', level: 1, object_type: ['物品', '动作'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一个人,从你身边走过?', level: 1, object_type: ['人物', '动作'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一阵风,你感觉到了?', level: 1, object_type: ['身体'], sense: ['触觉', '空间'], language: 'zh' },
  { text: '今天有没有一个细节,你多看了一眼?', level: 1, object_type: ['泛', '动作'], sense: ['视觉'], language: 'zh' },
  { text: '今天有没有一种累,坐下来才感觉到?', level: 1, object_type: ['身体'], sense: ['身体感觉'], language: 'zh' },
  { text: '今天有没有一个画面,到现在还记得?', level: 1, object_type: ['影像'], sense: ['视觉', '内在'], language: 'zh' },
  { text: '今天有没有一个地方,你注意到光?', level: 1, object_type: ['地点', '影像'], sense: ['视觉', '空间'], language: 'zh' },
  { text: '今天有没有一个声音,你分不清从哪来?', level: 1, object_type: ['声音', '地点'], sense: ['听觉', '空间'], language: 'zh' },
  { text: '今天有没有一个东西,你握了一下又放下?', level: 1, object_type: ['物品', '动作'], sense: ['触觉'], language: 'zh' },
  { text: '今天有没有一秒钟,周围突然安静了?', level: 1, object_type: ['时间', '声音'], sense: ['时间', '听觉'], language: 'zh' },
  { text: '今天有没有一个味道,你不自觉闻了又闻?', level: 1, object_type: ['气味', '动作'], sense: ['嗅觉'], language: 'zh' },
  { text: '今天有没有一句话,你想说给人,但没找到人?', level: 1, object_type: ['一句话', '人物'], sense: ['听觉'], language: 'zh' },
  // ── 新增:变换句式,打破「今天有没有一个」的单调感 ──
  { text: '刚才脑子里闪过什么?', level: 1, object_type: ['泛'], sense: ['内在'], language: 'zh' },
  { text: '写下一个今天不想忘记的瞬间', level: 1, object_type: ['时间', '影像'], sense: ['内在', '视觉'], language: 'zh' },
  { text: '今天有什么事让你轻轻笑了一下?', level: 1, object_type: ['动作', '人物'], sense: ['内在', '听觉'], language: 'zh' },
  { text: '此刻身体哪里最累?', level: 1, object_type: ['身体'], sense: ['身体感觉'], language: 'zh' },
  { text: '如果给今天选一种颜色,是什么?', level: 1, object_type: ['影像'], sense: ['视觉', '内在'], language: 'zh' },
  { text: '今天最安静的一刻是什么时候?', level: 1, object_type: ['时间', '声音'], sense: ['听觉', '时间'], language: 'zh' },
  { text: '有什么话,今天在心里说了一遍又一遍?', level: 1, object_type: ['一句话'], sense: ['内在', '听觉'], language: 'zh' },
  { text: '今天你避开了什么?', level: 1, object_type: ['动作', '泛'], sense: ['内在'], language: 'zh' },
  { text: '窗外现在是什么样子?', level: 1, object_type: ['地点', '影像'], sense: ['视觉', '空间'], language: 'zh' },
  { text: '写一句今天听到的话', level: 1, object_type: ['一句话'], sense: ['听觉'], language: 'zh' },
  { text: '今天的哪个瞬间让你想按暂停?', level: 1, object_type: ['时间', '动作'], sense: ['时间', '内在'], language: 'zh' },
  { text: '现在手边有什么?它怎么出现在这的?', level: 1, object_type: ['物品'], sense: ['视觉', '触觉'], language: 'zh' },
  { text: '今天你等了什么?', level: 1, object_type: ['时间', '动作'], sense: ['时间', '内在'], language: 'zh' },
  { text: '用一个词形容今天的天空', level: 1, object_type: ['影像', '地点'], sense: ['视觉'], language: 'zh' },
  { text: '今天谁的声音你听得最久?', level: 1, object_type: ['人物', '声音'], sense: ['听觉'], language: 'zh' },
  { text: '闭上眼,现在还残留什么触感?', level: 1, object_type: ['身体', '物品'], sense: ['触觉', '身体感觉'], language: 'zh' },
  { text: '今天你走了哪条不常走的路?', level: 1, object_type: ['地点', '动作'], sense: ['空间', '视觉'], language: 'zh' },
  { text: '有没有什么东西,今天坏掉了?', level: 1, object_type: ['物品'], sense: ['视觉', '触觉'], language: 'zh' },
  { text: '今天最暖的一刻是什么?', level: 1, object_type: ['时间', '身体'], sense: ['身体感觉', '内在'], language: 'zh' },
  { text: '写下一个今天突然想起的人', level: 1, object_type: ['人物'], sense: ['内在'], language: 'zh' },
];

// ============================================================
// Window Provider
// ------------------------------------------------------------
// UI 只向 Provider 要当前 Window / 下一扇窗,不直接关心选择策略。
// 第一版使用均等机会的确定性洗牌;以后天气、节日、历史或实验策略
// 都应长在 Provider 内部,不改 UI。
// ============================================================

export type WindowProvider = {
  peekWindow: () => WindowItem;
  getNextWindow: () => WindowItem;
  replaceWindow: (currentWindow?: WindowItem) => WindowItem;
};

function createWindowSeed(date: Date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function hashSeed(seed: string | number) {
  const input = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string | number) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createWindowDeck(seed: string | number) {
  if (WINDOWS.length === 0) {
    throw new Error('WINDOWS is empty');
  }

  const random = createSeededRandom(seed);
  const deck = [...WINDOWS];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function getWindowIndex(windowItem: WindowItem) {
  return WINDOWS.findIndex((item) => item.text === windowItem.text);
}

export function findWindowByText(text: string) {
  return WINDOWS.find((item) => item.text === text) || null;
}

export function createWindowProvider(seed: string | number = createWindowSeed()): WindowProvider {
  const deck = createWindowDeck(seed);
  let cursor = 0;

  const readNext = () => {
    const item = deck[cursor % deck.length];
    cursor += 1;
    return item;
  };

  return {
    peekWindow: () => deck[cursor % deck.length],
    getNextWindow: readNext,
    replaceWindow: (currentWindow) => {
      if (deck.length <= 1) return deck[0];

      let next = readNext();
      let guard = 0;
      while (currentWindow && next.text === currentWindow.text && guard < deck.length) {
        next = readNext();
        guard += 1;
      }
      return next;
    },
  };
}

const defaultWindowProvider = createWindowProvider();

export function peekWindow() {
  return defaultWindowProvider.peekWindow();
}

export function getNextWindow() {
  return defaultWindowProvider.getNextWindow();
}

export function replaceWindow(currentWindow?: WindowItem) {
  return defaultWindowProvider.replaceWindow(currentWindow);
}

