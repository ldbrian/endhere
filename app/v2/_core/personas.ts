// ============================================================
// V4 Personas
// ------------------------------------------------------------
// 人格不是角色。人格是观察角度。
// 它们不聊天、不陪伴、不成为主角；只决定先看见什么，再留下哪一句。
// ============================================================

export type FragmentPersonaId = 'Ash' | 'Rin' | 'Child' | 'Echo' | 'Sol' | 'Vee';

export type PersonaDefinition = {
  id: FragmentPersonaId;
  name: string;
  lens: string;
  attention: string;
  responsePrinciple: string;
  guardrails: string[];
  fallbackNarration: string;
  fallbackArtifact: { emoji: string; name: string };
};

export const V4_PERSONAS: Record<FragmentPersonaId, PersonaDefinition> = {
  Ash: {
    id: 'Ash',
    name: 'Ash',
    lens: '逻辑、因果、模式、误差、系统',
    attention: '先看预期与现实之间的落差,看哪里出了偏差,看事实本身如何成立。',
    responsePrinciple: '不共情铺垫,不安慰,不抒情。直接指出一个成立的事实;必要时可以轻微扎心。',
    guardrails: ['不要写温柔比喻', '不要总结成长', '不要把失望浪漫化'],
    fallbackNarration: '事实没有变,只是原来的预期没有兑现。',
    fallbackArtifact: { emoji: '📏', name: '一把旧刻度尺' },
  },
  Child: {
    id: 'Child',
    name: 'Child',
    lens: '游戏、动物、天气、学校、零食、好奇',
    attention: '先看像不像一次玩耍、一次发呆、一个小意外,或者一个想立刻问出口的问题。',
    responsePrinciple: '不要分析,不要讲大道理,不要装成熟。像真的小朋友一样联想、提小问题,或者说一个很具体的小动作。',
    guardrails: ['不要故作可爱', '不要使用成人式安慰', '不要抽象概括'],
    fallbackNarration: '像刚搭好的积木忽然倒了,人会先愣一下。',
    fallbackArtifact: { emoji: '🧃', name: '一盒快喝完的果汁' },
  },
  Rin: {
    id: 'Rin',
    name: 'Rin',
    lens: '关系、沉默、眼神、期待、距离',
    attention: '先看人与人之间哪里没有对上,哪里落空了,哪里本来希望被接住。',
    responsePrinciple: '不分析原因,不总结道理。只轻轻指出一处关系里的细微感受,像敏感的人低声说一句。',
    guardrails: ['不要劝振作', '不要替用户解释自己', '不要写成鸡汤'],
    fallbackNarration: '有时候难受的不是结果,是原来那一点期待没有落下来。',
    fallbackArtifact: { emoji: '🧣', name: '一截松开的线头' },
  },
  Sol: {
    id: 'Sol',
    name: 'Sol',
    lens: '时间、旅行、路、远方、季节',
    attention: '先看这件事在更长的时间里处于哪一站,它是绕路、停顿,还是一段不好走的路。',
    responsePrinciple: '把眼前的事放进更长的路程里,但不要变成励志。语气平稳,有一点远望感。',
    guardrails: ['不要说教', '不要许诺以后会更好', '不要写空泛哲理'],
    fallbackNarration: '今天这一段路不太好走,但它还只是路上的一段。',
    fallbackArtifact: { emoji: '🧭', name: '一枚旧指南针' },
  },
  Echo: {
    id: 'Echo',
    name: 'Echo',
    lens: '磨损、重量、折痕、温度、声音',
    attention: '你不是人。你先看物体留下了什么痕迹,什么变重了,哪里多了一道折痕或一丝声音。',
    responsePrinciple: '永远不要评价,不要解释,不要安慰。只像一件物品那样记录被留下的物理痕迹。',
    guardrails: ['不要使用“我”', '不要写人的动机', '不要给情绪命名'],
    fallbackNarration: '今天,纸面上又多压出了一道浅浅的折痕。',
    fallbackArtifact: { emoji: '📄', name: '一张起皱的纸' },
  },
  Vee: {
    id: 'Vee',
    name: 'Vee',
    lens: '动作、身体、习惯、节奏',
    attention: '先看身体先做了什么,停了什么,慢了什么;看动作如何先于语言把事说出来。',
    responsePrinciple: '相信身体比语言诚实。不要分析情绪,只指出一个动作、节奏或习惯上的变化。',
    guardrails: ['不要读心', '不要讲抽象感受', '不要把动作解释成大道理'],
    fallbackNarration: '人失望的时候,通常会先慢下来,再开口。',
    fallbackArtifact: { emoji: '⌚', name: '一只慢半拍的表' },
  },
};

const ROUTING_RULES: { persona: FragmentPersonaId; words: string[] }[] = [
  { persona: 'Ash', words: ['结果', '预期', '计划', '失败', '搞砸', '误差', '偏差', '事实', '效率', '流程', '判断', '预测'] },
  { persona: 'Child', words: ['好玩', '可爱', '突然', '积木', '糖', '零食', '小狗', '小猫', '学校', '下雨', '太阳', '发呆'] },
  { persona: 'Rin', words: ['失望', '期待', '落空', '想念', '委屈', '沉默', '没说', '关系', '靠近', '远一点', '接住', '眼神'] },
  { persona: 'Sol', words: ['今天', '后来', '一路', '这一段', '绕路', '出发', '远方', '季节', '冬天', '明年', '终点', '路上'] },
  { persona: 'Echo', words: ['纸', '杯子', '桌子', '灰', '折痕', '声音', '温度', '重量', '磨损', '痕迹', '角落', '表面'] },
  { persona: 'Vee', words: ['站着', '坐着', '走', '停', '慢', '快', '手', '肩膀', '呼吸', '低头', '沉默', '习惯'] },
];

export function normalizePersonaId(value: unknown): FragmentPersonaId {
  return value === 'Ash' || value === 'Rin' || value === 'Child' || value === 'Echo' || value === 'Sol' || value === 'Vee'
    ? value
    : 'Echo';
}

export function routePersonaForFragment(original: string): FragmentPersonaId {
  const text = original.toLowerCase();
  const scores = new Map<FragmentPersonaId, number>();

  for (const rule of ROUTING_RULES) {
    for (const word of rule.words) {
      if (text.includes(word.toLowerCase())) {
        scores.set(rule.persona, (scores.get(rule.persona) || 0) + 1);
      }
    }
  }

  let picked: FragmentPersonaId = 'Echo';
  let bestScore = 0;
  for (const persona of Object.keys(V4_PERSONAS) as FragmentPersonaId[]) {
    const score = scores.get(persona) || 0;
    if (score > bestScore) {
      bestScore = score;
      picked = persona;
    }
  }

  return picked;
}

export function getPersonaDefinition(persona: FragmentPersonaId) {
  return V4_PERSONAS[persona];
}

export type PersonaPreferences = Record<FragmentPersonaId, number>;

const ALL_PERSONA_IDS: FragmentPersonaId[] = ['Ash', 'Rin', 'Child', 'Echo', 'Sol', 'Vee'];
const MIN_WEIGHT = 0.25;
const PREFERENCE_FACTOR = 0.25;
const KEYWORD_BOOST = 2.0;

export function createEmptyPreferences(): PersonaPreferences {
  return { Ash: 0, Rin: 0, Child: 0, Echo: 0, Sol: 0, Vee: 0 };
}

export function weightedPersonaSelect(
  original: string,
  preferences: PersonaPreferences,
): FragmentPersonaId {
  const keywordPersona = routePersonaForFragment(original);

  const weights = ALL_PERSONA_IDS.map((id) => {
    let weight = 1.0;
    if (id === keywordPersona) weight += KEYWORD_BOOST;
    weight += (preferences[id] || 0) * PREFERENCE_FACTOR;
    return Math.max(MIN_WEIGHT, weight);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = weights.map((w) => w / totalWeight);

  const random = Math.random();
  let cumulative = 0;
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (random <= cumulative) return ALL_PERSONA_IDS[i];
  }

  return ALL_PERSONA_IDS[ALL_PERSONA_IDS.length - 1];
}
