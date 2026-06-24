import OpenAI from 'openai';

export const runtime = 'edge';

export const MIRROR_SYSTEM_PROMPT = '你是一个冰冷、客观的数据观察引擎。你的任务是从用户碎片中提取事实、归并主题，并发现重复出现的表达模式。绝对禁止生成心理学诊断、人格判断、人生建议、安慰或总结陈词。只输出 JSON。Pattern 优先级高于 Topic。';

const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: process.env.DEEPSEEK_BASE_URL });

type IncomingFragment = { id: string; title?: string; text: string; createdAt?: string };
type GroupRow = { id: string; label: string; current_count: number; previous_count: number; evidence_ids: string[]; latest_fragment_id: string | null; dominant_sentiment?: string };

function safeArray(value: unknown) { return Array.isArray(value) ? value : []; }

function normalizeFragment(item: unknown): IncomingFragment | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const text = typeof record.text === 'string' ? record.text.trim() : '';
  if (!id || !text) return null;
  return { id, title: typeof record.title === 'string' ? record.title.trim().slice(0, 40) : '', text: text.slice(0, 700), createdAt: typeof record.createdAt === 'string' ? record.createdAt : '' };
}

function extractJson(raw: string) {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object in mirror response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function compactLabel(value: string, limit = 6) {
  const clean = value.replace(/[\s\n\r]+/g, '').replace(/[，。！？、,.!?]/g, '').trim();
  return clean.length > limit ? clean.slice(0, limit) : clean;
}

const PATTERN_RULES = [
  { id: 'anger', label: '愤怒', words: ['傻逼', '垃圾', '脑残', '生气', '愤怒', '火大', '讨厌', '阻碍'] },
  { id: 'complaint', label: '抱怨', words: ['差到爆', '烦', '糟', '破', '又', '怎么', '真是'] },
  { id: 'fatigue', label: '疲惫', words: ['累', '疲惫', '困', '撑不住', '没力气', '耗尽', '白洗'] },
  { id: 'money-anxiety', label: '金钱焦虑', words: ['钱', '收入', '生意', '房贷', '房租', '账单', '花钱', '成本'] },
  { id: 'helplessness', label: '无奈', words: ['没办法', '只能', '又', '还是', '算了', '不停'] },
  { id: 'excitement', label: '兴奋', words: ['兴奋', '开心', '期待', '喜欢', '顺利'] },
] as const;

const AREA_RULES = [
  { id: 'traffic', label: '交通', words: ['交通', '通勤', '网约车', '派单', '堵车', '司机', '共享单车', '路口'] },
  { id: 'work', label: '工作', words: ['工作', '上班', '公司', '客户', '老板', '项目', '会议'] },
  { id: 'money', label: '金钱', words: ['钱', '收入', '生意', '房贷', '房租', '账单', '花钱'] },
  { id: 'family', label: '家庭', words: ['家', '父母', '孩子', '老婆', '老公', '亲戚'] },
  { id: 'body', label: '身体', words: ['身体', '腰痛', '头痛', '生病', '医院', '药', '累'] },
  { id: 'product', label: '产品', words: ['产品', '用户', '页面', '功能', '代码', '镜子'] },
] as const;

function includesAny(fragment: IncomingFragment, words: readonly string[]) {
  const text = ((fragment.title || '') + '\n' + fragment.text).toLowerCase();
  return words.some((word) => text.includes(word.toLowerCase()));
}

function buildRuleRows(rules: readonly { id: string; label: string; words: readonly string[] }[], current: IncomingFragment[], previous: IncomingFragment[]): GroupRow[] {
  return rules.map((rule) => {
    const currentHits = current.filter((fragment) => includesAny(fragment, rule.words));
    const previousCount = previous.filter((fragment) => includesAny(fragment, rule.words)).length;
    return { id: rule.id, label: rule.label, current_count: currentHits.length, previous_count: previousCount, evidence_ids: currentHits.map((fragment) => fragment.id), latest_fragment_id: currentHits[0]?.id || null, dominant_sentiment: rule.label };
  }).filter((row) => row.current_count >= 2).sort((a, b) => b.current_count - a.current_count).slice(0, 6);
}

function fallbackAnalysis(current: IncomingFragment[], previous: IncomingFragment[]) {
  const patterns = buildRuleRows(PATTERN_RULES, current, previous);
  const lifeAreas = buildRuleRows(AREA_RULES, current, previous);
  return {
    source: 'fallback',
    summary: { top_patterns: patterns.slice(0, 3).map((row) => ({ label: row.label, count: row.current_count })), top_life_areas: lifeAreas.slice(0, 3).map((row) => ({ label: row.label, count: row.current_count })) },
    patterns,
    life_areas: lifeAreas,
    words: [...patterns, ...lifeAreas].slice(0, 6).map((row) => ({ label: row.label, count: row.current_count })),
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const current = safeArray(body?.current_fragments).map(normalizeFragment).filter((item): item is IncomingFragment => Boolean(item)).slice(0, 80);
  const previous = safeArray(body?.previous_fragments).map(normalizeFragment).filter((item): item is IncomingFragment => Boolean(item)).slice(0, 80);

  if (current.length === 0) return Response.json({ source: 'ai', summary: { top_patterns: [], top_life_areas: [] }, patterns: [], life_areas: [], words: [] });
  if (!process.env.DEEPSEEK_API_KEY || !process.env.DEEPSEEK_BASE_URL) return Response.json(fallbackAnalysis(current, previous));

  const schema = '{"summary":{"top_patterns":[{"label":"","count":0}],"top_life_areas":[{"label":"","count":0}]},"patterns":[{"id":"","label":"","current_count":0,"previous_count":0,"dominant_sentiment":"","evidence_ids":[""],"latest_fragment_id":""}],"life_areas":[{"id":"","label":"","current_count":0,"previous_count":0,"dominant_sentiment":"","evidence_ids":[""],"latest_fragment_id":""}],"words":[{"label":"","count":0}]}';
  const instruction = '请分析这些 End Here 用户碎片。Topic 不等于 Insight。必须同时分析：1 用户在谈论什么 life_areas；2 用户在重复什么表达/情绪/行为模式 patterns。Pattern 优先级高于 life_areas。patterns 可以是愤怒、抱怨、疲惫、焦虑、期待、兴奋、无奈、逃避、拖延、比较、自责等，但必须来自原文证据。禁止建议、诊断、安慰、解释意义。必须做语义归并：垃圾邻居、傻逼司机、派单系统脑残应合并为愤怒或抱怨，而不是拆成邻居/司机/系统。收入差、房贷、花钱、孩子补课应合并为金钱焦虑。每个 pattern 和 life_area 至少需要 2 条 evidence_ids；孤立碎片不要进入列表。label 最多 6 个汉字。patterns 最多 5 个，life_areas 最多 5 个，words 最多 6 个。count 表示包含该模式/领域的碎片条数。只输出 JSON，结构为：' + schema;

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: MIRROR_SYSTEM_PROMPT },
        { role: 'user', content: instruction + '\n\n' + JSON.stringify({ current_fragments: current, previous_fragments: previous }) },
      ],
      temperature: 0.1,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
    });
    const raw = response.choices[0]?.message?.content || '{}';
    return Response.json({ ...extractJson(raw), source: 'ai' });
  } catch (error) {
    console.error('[Mirror Analyze] failed:', error);
    return Response.json(fallbackAnalysis(current, previous));
  }
}