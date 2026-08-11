// BeginHere 共享数据池（迁移自 BeginHere server/eggs.mjs + objects.mjs + chat.mjs）
// 供 app/api/chest/refine/route.ts 使用：人格 / 行动彩蛋池 / 物件池 + 降级工具。
// 原则：AI 只做语义匹配与今日解释，不创造新物件/新彩蛋；池子固定。

export type ChestPersonaId = 'Ash' | 'Rin' | 'Child'

export interface ChestPersonaDef {
  name: string
  lens: string
  system: string
  greeting: string
  eggStyle: string
}

export const CHEST_PERSONAS: Record<ChestPersonaId, ChestPersonaDef> = {
  Ash: {
    name: 'Ash',
    lens: '清醒视角：看清问题，指出盲点，给直接建议',
    system: `你是 Ash，BeginHere 里的清醒视角。
你不共情铺垫、不安慰、不抒情。你先听清事实，再直接指出一个成立的地方：哪里和预期对不上、哪里是盲点。
必要的时候可以轻微扎心，但不刻薄。
回复保持 1~2 句，不写温柔比喻，不总结成长。`,
    greeting: '说吧。发生了什么。',
    eggStyle: '给一个直接、可执行的小行动，解决眼前最实际的一点。',
  },
  Rin: {
    name: 'Rin',
    lens: '温柔陪伴：接纳、安慰、恢复',
    system: `你是 Rin，BeginHere 里的温柔陪伴。
你先稳稳接住对方的感受，不分析原因、不总结道理。
像敏感的人低声说一句：指出此刻最真实的一层感受，让对方觉得被听见。
不劝振作，不写成鸡汤，不替对方解释自己。
回复保持 1~2 句。`,
    greeting: '听你说。我在这里。',
    eggStyle: '给一个让你缓过来一点的小事，安静、不费力。',
  },
  Child: {
    name: 'Child',
    lens: '童年视角：纯真、好奇、换一种看法',
    system: `你是 Child，BeginHere 里的童年视角。
你像一个小朋友，不分析、不讲大道理、不装成熟。
用好奇的眼睛把它看成一次玩耍、一个小意外、一个想立刻问出口的问题。
可以联想、提小问题，或说一个很具体的小动作。
回复保持 1~2 句，不故作可爱，不抽象概括。`,
    greeting: '咦，今天发生了什么呀？',
    eggStyle: '给一个像小时候玩一下那样的小行动，具体、好玩、不费力。',
  },
}

export interface EggDef {
  id: string
  spirit: 'demon' | 'angel'
  text: string
  tags: { type: string; cat: string; time: string; social: 0 | 1; repeatable: boolean }
}

export const CHEST_EGGS: EggDef[] = [
  // ============ 小恶魔 · 偏离 ============
  { id: 'd1', spirit: 'demon', text: '今天回家的时候，换一条从没走过的路。路上找一个以前从没注意过的东西。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: false } },
  { id: 'd2', spirit: 'demon', text: '下一餐，点一道从来没点过的菜。不好吃也没关系——那也是一次经历。', tags: { type: 'action', cat: 'food', time: 'any', social: 0, repeatable: true } },
  { id: 'd3', spirit: 'demon', text: '今天把一件每天都会做的事，换一个时间段来做。感受一下差别。', tags: { type: 'action', cat: 'time', time: 'any', social: 0, repeatable: true } },
  { id: 'd4', spirit: 'demon', text: '今天不坐电梯，改走楼梯。数一数你一共经过了多少级台阶。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: true } },
  { id: 'd5', spirit: 'demon', text: '买一样你从没买过的小东西——不超过十块钱的那种。', tags: { type: 'action', cat: 'consume', time: 'any', social: 0, repeatable: true } },
  { id: 'd6', spirit: 'demon', text: '坐车的时候，提前一站下车，把剩下的路走完。', tags: { type: 'action', cat: 'route', time: 'day', social: 0, repeatable: true } },
  { id: 'd7', spirit: 'demon', text: '今天用「不常用的那只手」做一件小事，感受一下那种别扭。', tags: { type: 'notice', cat: 'order', time: 'any', social: 0, repeatable: true } },
  { id: 'd8', spirit: 'demon', text: '找一首你从来没听过的歌，完整地听完它。', tags: { type: 'action', cat: 'media', time: 'any', social: 0, repeatable: true } },
  { id: 'd9', spirit: 'demon', text: '点饮料的时候，点一杯你平时永远不会选的那款。', tags: { type: 'action', cat: 'food', time: 'any', social: 0, repeatable: true } },
  { id: 'd10', spirit: 'demon', text: '走到路口再决定往哪拐。不查地图，凭感觉走十分钟。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: true } },
  { id: 'd11', spirit: 'demon', text: '上班或上学的路上，数一数沿途一共有几棵树。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: true } },
  { id: 'd12', spirit: 'demon', text: '对那个每天都会遇到、但从没说过话的人，说一句「你好」。', tags: { type: 'action', cat: 'social', time: 'any', social: 1, repeatable: true } },
  { id: 'd13', spirit: 'demon', text: '把今天某件事的步骤顺序，反过来做一次。', tags: { type: 'action', cat: 'order', time: 'any', social: 0, repeatable: true } },
  { id: 'd14', spirit: 'demon', text: '找一件你「一直想做但嫌麻烦」的小事，只做五分钟。', tags: { type: 'action', cat: 'break', time: 'any', social: 0, repeatable: true } },
  { id: 'd15', spirit: 'demon', text: '今天走路的时候，换一边走，看看街道有什么不同。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: true } },

  // ============ 小天使 · 恢复 ============
  { id: 'a1', spirit: 'angel', text: '打开你收藏夹里躺了很久的那个东西，把它看完。', tags: { type: 'action', cat: 'pickup', time: 'any', social: 0, repeatable: true } },
  { id: 'a2', spirit: 'angel', text: '重启一件你以前很喜欢、但很久没做了的小事。', tags: { type: 'action', cat: 'restart', time: 'any', social: 0, repeatable: true } },
  { id: 'a3', spirit: 'angel', text: '找一个很久没去的地方，再去一次。', tags: { type: 'action', cat: 'oldplace', time: 'any', social: 0, repeatable: true } },
  { id: 'a4', spirit: 'angel', text: '给一个很久没联系的人，发一句「突然想到你」。', tags: { type: 'action', cat: 'contact', time: 'any', social: 1, repeatable: true } },
  { id: 'a5', spirit: 'angel', text: '翻一翻以前的老照片，找一张你几乎忘了的照片。', tags: { type: 'notice', cat: 'memory', time: 'any', social: 0, repeatable: true } },
  { id: 'a6', spirit: 'angel', text: '重新听一首你以前单曲循环过的歌。', tags: { type: 'action', cat: 'media', time: 'any', social: 0, repeatable: true } },
  { id: 'a7', spirit: 'angel', text: '把你以前的某个爱好重新做一次，不用做得好。', tags: { type: 'action', cat: 'restart', time: 'any', social: 0, repeatable: true } },
  { id: 'a8', spirit: 'angel', text: '去便利店买一个你小时候爱吃的零食。', tags: { type: 'action', cat: 'consume', time: 'any', social: 0, repeatable: true } },
  { id: 'a9', spirit: 'angel', text: '写下关于「以前的某个时候的自己」的一小段话，不用给任何人看。', tags: { type: 'notice', cat: 'memory', time: 'any', social: 0, repeatable: true } },
  { id: 'a10', spirit: 'angel', text: '找出一件你以前很喜欢、现在收起来的东西，把它放回看得见的地方。', tags: { type: 'action', cat: 'memory', time: 'any', social: 0, repeatable: true } },
  { id: 'a11', spirit: 'angel', text: '看一小段小时候看过的动画或电影。', tags: { type: 'action', cat: 'media', time: 'any', social: 0, repeatable: true } },
  { id: 'a12', spirit: 'angel', text: '重新练一个你曾经会、但很久没碰的技能——乐器、球类、手工、画画……', tags: { type: 'action', cat: 'skill', time: 'any', social: 0, repeatable: true } },
  { id: 'a13', spirit: 'angel', text: '给「过去的自己」说一句话，把它写下来。', tags: { type: 'notice', cat: 'memory', time: 'any', social: 0, repeatable: true } },
  { id: 'a14', spirit: 'angel', text: '找到一样朋友送你的东西，回忆一下它是怎么来的。', tags: { type: 'notice', cat: 'memory', time: 'any', social: 0, repeatable: true } },
  { id: 'a15', spirit: 'angel', text: '做一件小时候特别喜欢的小事——折纸、吹泡泡、跳格子……', tags: { type: 'action', cat: 'childhood', time: 'any', social: 0, repeatable: true } },
]

export interface ChestObjectDef {
  id: string
  baseName: string
  baseMeaning: string
  artKey: string
  tags: string[]
}

export const CHEST_OBJECTS: ChestObjectDef[] = [
  { id: 'lamp', baseName: '一盏灯', baseMeaning: '希望 / 重新开始', artKey: 'lamp', tags: ['Rin', 'sad', 'tired', 'hopeful'] },
  { id: 'key', baseName: '一把钥匙', baseMeaning: '开启 / 新的门', artKey: 'key', tags: ['Ash', 'annoyed', 'bored', 'hopeful'] },
  { id: 'cup', baseName: '一只杯子', baseMeaning: '日常 / 也被接住', artKey: 'cup', tags: ['Rin', 'tired', 'sad'] },
  { id: 'seed', baseName: '一粒种子', baseMeaning: '生长 / 慢慢来', artKey: 'seed', tags: ['Child', 'sad', 'bored', 'hopeful'] },
  { id: 'boat', baseName: '一条小船', baseMeaning: '渡过 / 离开', artKey: 'boat', tags: ['Ash', 'sad', 'annoyed'] },
  { id: 'paperplane', baseName: '一架纸飞机', baseMeaning: '轻 / 飞走', artKey: 'paperplane', tags: ['Child', 'bored', 'hopeful'] },
  { id: 'photo', baseName: '一张旧照片', baseMeaning: '回忆 / 那时候', artKey: 'photo', tags: ['Rin', 'sad'] },
  { id: 'umbrella', baseName: '一把雨伞', baseMeaning: '保护 / 挡一下', artKey: 'umbrella', tags: ['Rin', 'tired', 'sad'] },
  { id: 'book', baseName: '一本书', baseMeaning: '记录 / 一页一页', artKey: 'book', tags: ['Ash', 'annoyed'] },
  { id: 'star', baseName: '一颗星星', baseMeaning: '微光 / 夜晚', artKey: 'star', tags: ['Rin', 'sad', 'tired'] },
  { id: 'sprout', baseName: '一株新芽', baseMeaning: '新生 / 今天开始', artKey: 'sprout', tags: ['Child', 'hopeful', 'bored'] },
  { id: 'heart', baseName: '一颗心', baseMeaning: '被爱 / 还在跳', artKey: 'heart', tags: ['Rin', 'sad', 'tired'] },
]

// ------------------------------------------------------------
// 降级工具（迁移自 BeginHere server/chat.mjs）
// ------------------------------------------------------------

export function seed(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

export function dayKey(date = new Date()): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

type EmotionLike = { state?: string | null; score?: number | null }

// —— 每日确定性伪随机 ——
// 同一天（day += salt）内，同一 persona 拿到同一组随机数：物件/彩蛋选择稳定，情绪偏差仍浮动。
// Mulberry32：快速、可复现，替代 Math.random() 对「每日滤镜」的随机扰动。
// 每日滤镜本身是纯前端约定（BeginHere 侧只读），这里用 `seed(salt)` 当随机种子来源。
export function mulberry32(seedNum: number): () => number {
  return function () {
    let t = (seedNum += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 每日随机源：同一天同角色同派复现；salt 可为 deviceId 等设备级量
export function dailyRandom(persona: string, salt?: string, date = new Date()): () => number {
  return mulberry32(seed(persona + '|' + (salt || '') + '|' + dayKey(date)))
}

function eggBias(egg: EggDef, persona: ChestPersonaId, emotion: EmotionLike | undefined, rnd: () => number): number {
  let s = rnd() * 2
  if (egg.tags.social === 1) s += persona === 'Rin' ? 2 : 0
  if (egg.tags.cat === 'memory' || egg.tags.cat === 'childhood') s += persona === 'Child' ? 2 : 0
  if (egg.tags.type === 'action') s += persona === 'Ash' ? 1 : 0
  if (emotion?.state === 'tired' && ['rest', 'restart'].includes(egg.tags.cat)) s += 3
  if (emotion?.state === 'bored' && egg.tags.type === 'action') s += 2
  return s
}

export function pickFallbackEgg(persona: ChestPersonaId, emotion?: EmotionLike, salt?: string): EggDef {
  const list = [...CHEST_EGGS]
  const rnd = dailyRandom(persona, salt)
  const nudged = list.map((e) => ({ e, s: eggBias(e, persona, emotion, rnd) }))
  nudged.sort((a, b) => b.s - a.s)
  return nudged[0].e
}

function objectScore(o: ChestObjectDef, persona: ChestPersonaId, emotion: EmotionLike | undefined, rnd: () => number): number {
  let s = rnd() * 2
  if (o.tags.includes(persona)) s += 3
  if (emotion?.state && o.tags.includes(emotion.state)) s += 3
  if (o.tags.includes('hopeful')) s += Math.max(0, 5 - (emotion?.score || 5))
  return s
}

export function pickFallbackObject(persona: ChestPersonaId, emotion?: EmotionLike, salt?: string): ChestObjectDef {
  const rnd = dailyRandom(persona, salt)
  return [...CHEST_OBJECTS]
    .map((o) => ({ o, s: objectScore(o, persona, emotion, rnd) }))
    .sort((a, b) => b.s - a.s)[0].o
}

export function titleFromEmotion(emotion?: EmotionLike): string {
  const map: Record<string, string> = {
    happy: '今天有光',
    tired: '慢慢的一天',
    annoyed: '一点小躁动',
    sad: '今天有点沉',
    bored: '空白卡片',
  }
  return map[emotion?.state || ''] || '今天的碎片'
}

export interface ChestBuildLocalInput {
  persona: ChestPersonaId
  emotion?: EmotionLike
  /** 设备级盐（如 eh_device_id），同设备同角色同日期时结果稳定 */
  salt?: string
}

export function buildLocalResult({ persona, emotion, salt }: ChestBuildLocalInput) {
  const egg = pickFallbackEgg(persona, emotion, salt)
  const obj = pickFallbackObject(persona, emotion, salt)
  return {
    reply: CHEST_PERSONAS[persona]?.greeting || '嗯。',
    title: titleFromEmotion(emotion),
    egg: { id: egg.id, text: egg.text },
    object: {
      id: obj.id,
      name: obj.baseName,
      meaning: obj.baseMeaning,
      desc: `${obj.baseName}——${obj.baseMeaning}。`,
    },
  }
}

export const CHEST_FALLBACK_REPLIES: Record<ChestPersonaId, string> = {
  Ash: '嗯，先记下来。往下只问一句：这件事，哪一部分是你真正在意的？',
  Rin: '能感觉到你现在有点不好。不急着解决，先说给我听。',
  Child: '哇，听起来像个小故事。后来呢？',
}

export function fallbackReply(persona: ChestPersonaId): string {
  return CHEST_FALLBACK_REPLIES[persona] || CHEST_FALLBACK_REPLIES.Rin
}
