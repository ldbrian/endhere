import OpenAI from 'openai'
import {
  getPersonaDefinition,
  normalizePersonaId,
  routePersonaForFragment,
  weightedPersonaSelect,
  type FragmentPersonaId,
  type PersonaPreferences,
} from '../../../../v2/_core/personas'

export const runtime = 'edge'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

type OrganizedFragment = {
  title: string
  narration_content: string
  artifact: { emoji: string; name: string }
  persona: FragmentPersonaId
}

function fallbackTitle(original: string) {
  const firstLine = original.trim().split(/\n+/)[0] || '一块碎片'
  return firstLine.length > 12 ? `${firstLine.slice(0, 10)}...` : firstLine
}

function keepOneSentence(narration: string, original: string) {
  const compact = narration.trim().replace(/\s+/g, ' ')
  const hasOriginal = original.trim().length > 0
  const limit = 60

  if (!hasOriginal) return ''
  if (!compact) return ''

  const sentenceMatch = compact.match(/^.*?[。！？!?]/)
  const sentence = sentenceMatch?.[0]?.trim() || compact
  return sentence.length > limit ? sentence.slice(0, limit) : sentence
}

const ARTIFACT_RULES: { words: string[]; artifact: { emoji: string; name: string } }[] = [
  { words: ['车', '地铁', '公交', '路口', '堵', '导航', '派单', '司机'], artifact: { emoji: '🗺️', name: '一张揉皱的导航纸' } },
  { words: ['签', '合同', '客户', '谈成', '订单'], artifact: { emoji: '🖋️', name: '一支快没墨的签字笔' } },
  { words: ['孩子', '宝宝', '爸爸', '妈妈', '玩具'], artifact: { emoji: '🧸', name: '一只旧玩具熊' } },
  { words: ['雨', '伞', '淋', '湿'], artifact: { emoji: '☔', name: '一把还没晾干的雨伞' } },
  { words: ['吵', '老婆', '老公', '别扭', '冷战', '生气'], artifact: { emoji: '☕', name: '一只凉掉的咖啡杯' } },
  { words: ['钱', '收入', '房贷', '房租', '账单', '花'], artifact: { emoji: '🧾', name: '一张皱巴巴的收银小票' } },
  { words: ['累', '困', '加班', '熬夜', '撑不住'], artifact: { emoji: '🔋', name: '一块只剩一格的旧电池' } },
  { words: ['饭', '吃', '外卖', '餐', '饿'], artifact: { emoji: '🥢', name: '一双用过的外卖筷子' } },
  { words: ['梦', '醒', '失眠', '睡不着'], artifact: { emoji: '🌙', name: '一片被压扁的枕痕' } },
  { words: ['哭', '难过', '想念', '想起'], artifact: { emoji: '🎞️', name: '一张褪色的旧照片' } },
]

function pickFallbackArtifact(original: string, persona: FragmentPersonaId): { emoji: string; name: string } {
  const text = original.toLowerCase()
  for (const rule of ARTIFACT_RULES) {
    if (rule.words.some((word) => text.includes(word.toLowerCase()))) return rule.artifact
  }
  return getPersonaDefinition(persona).fallbackArtifact
}

function normalizeArtifact(value: unknown): { emoji: string; name: string } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const emoji = typeof record.emoji === 'string' ? record.emoji.trim().slice(0, 8) : ''
  const name = typeof record.name === 'string' ? record.name.trim().slice(0, 12) : ''
  if (!emoji || !name) return null
  return { emoji, name }
}

function fallbackOrganized(original: string, persona: FragmentPersonaId): OrganizedFragment {
  const definition = getPersonaDefinition(persona)
  return {
    title: fallbackTitle(original),
    narration_content: keepOneSentence(definition.fallbackNarration, original),
    artifact: pickFallbackArtifact(original, persona),
    persona,
  }
}

function extractJsonObject(raw: string) {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('No JSON object in organize response')
  return cleaned.slice(start, end + 1)
}

export async function POST(req: Request) {
  let original = ''
  let persona: FragmentPersonaId = 'Echo'

  try {
    const body = await req.json()
    original = typeof body.original_content === 'string' ? body.original_content.trim() : ''
    const preferences: PersonaPreferences | undefined =
      body.persona_preferences && typeof body.persona_preferences === 'object'
        ? body.persona_preferences
        : undefined
    persona = preferences
      ? weightedPersonaSelect(original, preferences)
      : routePersonaForFragment(original)

    if (!original) {
      return Response.json({ error: 'EMPTY_ORIGINAL_CONTENT' }, { status: 400 })
    }

    const definition = getPersonaDefinition(persona)
    const prompt = `
你是 EndHere V4 的 Response 与 Artifact 生成器。

最高公理:
帮助用户看见自己。不是心理咨询,不是 AI 聊天,不是教育用户,不是改变用户。
用户原文永远是主角。你的文字只是展品旁边的一张小说明牌。

已自动选择的观察角度:
- id: ${definition.id}
- lens: ${definition.lens}
- response_principle: ${definition.responsePrinciple}

重要边界:
- 人格不是角色。人格是观察角度。
- 不要自称 ${definition.name},不要说“我”,不要和用户聊天。
- 不要提到“作为 ${definition.name}”。
- 不要分析人格,不要解释人生,不要给建议,不要诊断,不要安慰成鸡汤。
- 不反驳用户,不教育用户,不复述用户原文。

任务:
为用户留下的一块生活碎片生成三样东西:
1. title: 一个具象、安静的标题。
2. narration_content: 一句旁白,像展品旁边的小标签,只接住这一块碎片。
3. artifact: 一件现实世界里可能存在的日常小物件,作为这块碎片留下的证物。

旁白要求:
- 必须是一句完整的话,不要超过两句。
- 目标 20~60 个中文;更短也可以,节奏比字数重要。
- 不要复述或改写用户原文。
- 不要出现“你应该 / 其实 / 说明 / 意味着 / 我觉得”。

Artifact 要求:
- 必须日常、普通、有画面感、可以存在于现实世界。
- 它不是奖励、不是徽章、不是收藏卡。
- artifact.name 最多 12 个中文。
- artifact.emoji 一个 emoji。

只返回 JSON,不要 Markdown,不要额外文字:
{
  "title": "一件展品名",
  "narration_content": "一句旁白",
  "artifact": { "emoji": "🧾", "name": "一件日常小物件" }
}
`

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: original },
      ],
      temperature: 0.35,
      max_tokens: 220,
    })

    const raw = response.choices[0]?.message?.content || ''
    const parsed = JSON.parse(extractJsonObject(raw)) as Partial<OrganizedFragment>
    const parsedPersona = normalizePersonaId(parsed.persona || persona)
    const safePersona = parsedPersona === persona ? parsedPersona : persona
    const fallback = fallbackOrganized(original, safePersona)
    const narration = keepOneSentence(String(parsed.narration_content || ''), original)

    return Response.json({
      title: String(parsed.title || fallback.title).trim().slice(0, 16),
      narration_content: narration || fallback.narration_content,
      artifact: normalizeArtifact(parsed.artifact) || pickFallbackArtifact(original, safePersona),
      persona: safePersona,
    })
  } catch (error) {
    console.error('[V4 Fragment Organize Error]:', error)
    return Response.json(original ? fallbackOrganized(original, persona) : { title: '一块碎片', narration_content: '', artifact: pickFallbackArtifact('', persona), persona })
  }
}