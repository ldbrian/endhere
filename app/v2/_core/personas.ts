// ============================================================
// V4 Personas
// ------------------------------------------------------------
// 人格不是角色。人格是观察角度。
// 它们不聊天、不陪伴、不成为主角;只为 Response 提供一种承接方式。
// ============================================================

export type FragmentPersonaId = 'Ash' | 'Rin' | 'Child' | 'Echo' | 'Sol' | 'Vee';

export type PersonaDefinition = {
  id: FragmentPersonaId;
  name: string;
  lens: string;
  responsePrinciple: string;
  fallbackNarration: string;
  fallbackArtifact: { emoji: string; name: string };
};

export const V4_PERSONAS: Record<FragmentPersonaId, PersonaDefinition> = {
  Ash: {
    id: 'Ash',
    name: 'Ash',
    lens: '理性、稳定、重量、承担',
    responsePrinciple: '看见这块碎片里被承担下来的重量,但不夸奖、不劝慰。',
    fallbackNarration: '这件事没有被解释,只是被稳稳放下了。',
    fallbackArtifact: { emoji: '🔑', name: '一把旧钥匙' },
  },
  Rin: {
    id: 'Rin',
    name: 'Rin',
    lens: '温柔、关系、安全感、轻轻接住',
    responsePrinciple: '看见这块碎片里需要被轻轻接住的关系或感受,但不安慰成鸡汤。',
    fallbackNarration: '它被轻轻放在这里,没有被催着变好。',
    fallbackArtifact: { emoji: '🧣', name: '一小截毛线' },
  },
  Child: {
    id: 'Child',
    name: 'Child',
    lens: '童真、惊喜、想象力、轻一点',
    responsePrinciple: '看见这块碎片里突然冒出来的好奇、荒唐或小小亮光,但不装可爱。',
    fallbackNarration: '这个瞬间很小,但它确实亮了一下。',
    fallbackArtifact: { emoji: '🧃', name: '一张糖纸' },
  },
  Echo: {
    id: 'Echo',
    name: 'Echo',
    lens: '观察、重复、模式、镜像',
    responsePrinciple: '看见这块碎片里的重复、痕迹或被注意到的细节,但不替用户总结。',
    fallbackNarration: '它像一个细节,被从今天里面单独留下了。',
    fallbackArtifact: { emoji: '🎞️', name: '一小段胶片' },
  },
  Sol: {
    id: 'Sol',
    name: 'Sol',
    lens: '原则、边界、价值观、认知',
    responsePrinciple: '看见这块碎片里出现的边界、选择或原则,但不教育用户该怎么做。',
    fallbackNarration: '这里有一条边界,它今天被你看见了。',
    fallbackArtifact: { emoji: '📖', name: '一张旧书签' },
  },
  Vee: {
    id: 'Vee',
    name: 'Vee',
    lens: '反差、幽默、叛逆、荒诞',
    responsePrinciple: '看见这块碎片里的反差、荒诞或不顺从,但不把它变成段子。',
    fallbackNarration: '它有点不讲道理,但今天就是这样发生了。',
    fallbackArtifact: { emoji: '🗒️', name: '一张便利贴' },
  },
};

const ROUTING_RULES: { persona: FragmentPersonaId; words: string[] }[] = [
  { persona: 'Ash', words: ['工作', '客户', '合同', '订单', '车', '地铁', '公交', '钱', '账单', '房贷', '责任', '撑住', '加班', '累', '困'] },
  { persona: 'Rin', words: ['想念', '难过', '委屈', '哭', '孤独', '害怕', '关系', '家', '妈妈', '爸爸', '朋友', '联系', '没说出口'] },
  { persona: 'Child', words: ['好玩', '可爱', '开心', '喜欢', '惊喜', '突然', '小孩', '玩具', '糖', '光', '颜色', '歌'] },
  { persona: 'Echo', words: ['又', '一直', '反复', '重复', '总是', '每天', '声音', '画面', '细节', '注意到', '记住', '梦'] },
  { persona: 'Sol', words: ['不想', '拒绝', '应该', '不能', '决定', '边界', '原则', '选择', '值得', '对不对', '为什么'] },
  { persona: 'Vee', words: ['离谱', '荒唐', '烦', '吐槽', '笑死', '尴尬', '破事', '算了', '服了', '不爽'] },
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

// ── Preference-weighted persona selection ──────────────────────
// P1-3: 这本书正在慢慢学会，怎样阅读它的主人。
// 不是推荐算法。是偏好学习。安静地。
// ────────────────────────────────────────────────────────────────

export type PersonaPreferences = Record<FragmentPersonaId, number>;

const ALL_PERSONA_IDS: FragmentPersonaId[] = ['Ash', 'Rin', 'Child', 'Echo', 'Sol', 'Vee'];
const MIN_WEIGHT = 0.25; // 最低保留 ~5% 概率，保持新鲜感
const PREFERENCE_FACTOR = 0.25; // 每点偏好对权重的影响
const KEYWORD_BOOST = 2.0; // 关键词匹配的额外权重加成

export function createEmptyPreferences(): PersonaPreferences {
  return { Ash: 0, Rin: 0, Child: 0, Echo: 0, Sol: 0, Vee: 0 };
}

/**
 * 带偏好的 persona 选择。
 * 基础：关键词路由提供加成（不是决定，是倾向）。
 * 偏好：用户历史 ♡/↻ 调整权重。
 * 最低：任何 persona 不会低于 ~5%。
 */
export function weightedPersonaSelect(
  original: string,
  preferences: PersonaPreferences,
): FragmentPersonaId {
  const keywordPersona = routePersonaForFragment(original);

  // 计算每个 persona 的权重
  const weights = ALL_PERSONA_IDS.map((id) => {
    // 基础权重
    let weight = 1.0;
    // 关键词匹配加成
    if (id === keywordPersona) weight += KEYWORD_BOOST;
    // 偏好调整
    weight += (preferences[id] || 0) * PREFERENCE_FACTOR;
    // 最低权重保障
    return Math.max(MIN_WEIGHT, weight);
  });

  // 归一化为概率
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = weights.map((w) => w / totalWeight);

  // 加权随机选择
  const random = Math.random();
  let cumulative = 0;
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (random <= cumulative) return ALL_PERSONA_IDS[i];
  }

  // 兜底（浮点精度）
  return ALL_PERSONA_IDS[ALL_PERSONA_IDS.length - 1];
}
