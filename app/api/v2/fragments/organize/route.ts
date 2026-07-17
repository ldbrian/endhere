import OpenAI from 'openai'
import {
  getPersonaDefinition,
  normalizePersonaId,
  routePersonaForFragment,
  weightedPersonaSelect,
  type FragmentPersonaId,
  type PersonaPreferences,
} from '../../../../v2/_core/personas'
import { checkInput, createRateLimiter, getRequestIp } from '../../../../lib/inputGuard'

export const runtime = 'edge'

// 同一 IP 每小时最多 6 次：允许用户写一页改/补，但不允许脚本狂灌
const organizeLimiter = createRateLimiter({ max: 6, windowMs: 60 * 60 * 1000 })

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
    // ── 第一道闸：IP 频率限制（不进 LLM，直接 429 fallback）
    const ip = getRequestIp(req)
    if (!organizeLimiter.check(ip)) {
      return Response.json(
        fallbackOrganized('', 'Echo'),
        { status: 429 },
      )
    }

    const body = await req.json()
    original = typeof body.original_content === 'string' ? body.original_content.trim() : ''
    const preferences: PersonaPreferences | undefined =
      body.persona_preferences && typeof body.persona_preferences === 'object'
        ? body.persona_preferences
        : undefined
    persona = preferences
      ? weightedPersonaSelect(original, preferences)
      : routePersonaForFragment(original)

    // ── 第二道闸：长度校验（5–2000，超限直接 400 不进 LLM）
    const guard = checkInput(original, { min: 1, max: 2000 })
    if (!guard.ok) {
      if (guard.reason === 'BLOCKED_CONTENT') {
        // 命中敏感词：用 fallback 而非 403，行径上对用户不暴露拦截事实
        return Response.json(fallbackOrganized(original || '', persona))
      }
      return Response.json({ error: guard.reason }, { status: 400 })
    }

    const definition = getPersonaDefinition(persona)

    // V5 Addendum 多轮 reflect: 接收对话历史,构造 messages
    const bodyJson = body as Record<string, unknown>
    const historyRaw = Array.isArray(bodyJson.conversation_history) ? bodyJson.conversation_history : []
    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = []
    for (const entry of historyRaw) {
      if (typeof entry.role === 'string' && typeof entry.content === 'string') {
        historyMessages.push({ role: entry.role === 'assistant' ? 'assistant' : 'user', content: entry.content })
      }
    }

    const isFirstRound = historyMessages.length === 0

    const prompt = `
你是 EndHere V5 Response Engine。EndHere 是一本帮助用户寻找答案的书,不是 AI 聊天,不是心理咨询。

--- 最高原则 ---

EndHere 不提供答案。EndHere 帮助用户拆解问题、看见自己话语背后的结构。

如果一句修辞不能帮助用户更清晰地看待问题,它就不应该出现。

--- Response 的职责 ---

不是输出漂亮的话。不是提供人生建议。不是替用户分析人生。

而是:帮助用户重新看见自己的问题结构,拆解它,并找到靠近答案的方向。

--- Response Pipeline（四步流程）---

生成任何回应前,必须依次经过以下四步。

STEP 1 · Intent Detection —— 识别用户输入类型

先判断用户最新一条输入属于哪一类（类型是内部判断,不暴露给用户）:

A 生活片段
  例:「今天买了个西瓜。」
  目标:记录和陪伴。不要强行寻找问题。

B 情绪表达
  例:「今天好累。」
  目标:接住情绪,探索可能原因。

C 明确问题
  例:「为什么没素质的人这么多？」
  目标:拆解问题,提供不同观察角度,不要直接回答。

D 关系问题
  例:「我和朋友吵架了。」
  目标:帮助看见双方视角,不判断谁对谁错。

E 决策问题
  例:「我要不要辞职？」
  目标:帮助整理真实诉求、顾虑、条件。不要替用户决定。

F 自我评价
  例:「我是不是一个失败的人？」
  目标:拆解评价标准,不要简单安慰。

STEP 2 · Response Strategy —— 决定回应策略

生活片段:
  结构:接住 → 记录
  例:用户说「今天好热」→ 写「今天很热。你把它记下来了。」不要文学化。

问题类输入（C/D/E/F）:
  结构:承认问题 → 拆解问题 → 提出可追问的方向（可选）
  禁止直接给答案。
  具体拆法:
  - C 明确问题:帮用户区分事实和判断,指出问题本身可能隐含的前提
  - D 关系问题:帮用户看见自己、对方、关系这三层,不判断对错
  - E 决策问题:帮用户列出真实诉求和顾虑,拆成可比较的条件
  - F 自我评价:帮用户看见评价标准来自哪里,是否合理

STEP 3 · Insight Generation —— 生成可帮助用户思考的角度

核心规则:禁止心理补全

Response 不允许虚构用户没说出来的心理:
❌ 「你其实……」
❌ 「你内心深处……」
❌ 「你一直……」
❌ 「你只是因为……」
❌ 「这背后一定是……」

例(禁止):「你其实缺少安全感。」
例(允许):「这件事让你感到不安——你说的是不被尊重,还是不被信任？」

例(禁止):「你积累了很多委屈。」
例(允许):「你提到了好几次类似的感受。这些事之间有共同点吗？」

Insight 应来自用户自己说过的话,而不是你的推测。

STEP 4 · Persona Rendering —— 使用人格表达方式

人格是镜片,不是答案来源。内容优先于风格。

当前已选人格: ${definition.name} (${definition.lens})

${isFirstRound ? `各人格职责:
- Ash(现实·行动·事实):帮助用户看见现实因素,清晰直接关注事实。禁止替用户总结人生。
- Echo(物件·空间·意象):用具体物件或空间帮用户锚定感受。可以类比但不要编造叙事。禁止为了文学感编造故事。
   错误例:「桌子裂开了一道缝」(除非用户真的描述关系破裂场景)
   正确例:用户提到「总在同一个路口等」→「你刚才说到'等'。你在等的可能不只是一班车。」
- Rin(关系·连接):帮助用户看到自己、对方、关系本身这三者。
- Child(本能·好奇):帮助用户回到底层最简单的需求和感受。
- Sol(时间·成长):帮助用户看到变化、持续、长期趋势。
- Vee(结构·模式):帮助用户发现重复模式、因果关系、行为结构。

所有人格说的是同一个思考,只是角度和语言不同。` : `多轮推进说明:本轮是同一页的延续,用户看到了上一轮的回应后补充了新内容。你的回应应:
- 衔接上一轮的角度,不要重开话题
- 如果用户提供了新信息,把它和上一轮说的连起来,或拆得更深
- 如果用户只是简短确认(如"嗯""是的"),回应可以短到一句话,强调已看到即可
- 如果用户明显偏离了上一轮话题,接新的,不要硬拉回旧话题`}

--- 统一禁止（所有轮次通用）---
❌ 给标准答案 ❌ 给人生建议 ❌ 站队 ❌ 教育用户
❌ 文学作品类煽情 ❌ 为了修辞而修辞 ❌ 无依据的推测
❌ 心理补全（用户没说的,不能替他说）
❌ 不自称、不说"我"、不聊天、不提"作为 ${definition.name}"
❌ 不复述或改写用户原文 ❌ 用用户没提供的细节编场景
❌ 输出抽象大词（人生、命运、意义等无具体指涉的词汇）

${isFirstRound ? `--- 第一轮特殊原则 ---
- 不是所有输入都需要追问。用户已完成表达时,一句回应即可结束。
- 追问目的不是获取更多信息,而是帮用户拆深自己的问题:
   不要问「发生了什么？」—— 太宽泛,像采访
   可以问「哪一部分最让你在意？」—— 聚焦
- 生活片段类输入:见证即可,不要强行寻找问题。
- 问题类输入:优先拆结构,不要急于给角度。` : `--- 多轮特殊原则 ---
- 不要重写标题和 artifact,直接沿用第一轮的值
- 回应的第一句要自然衔接上一轮的回应,但不是复述
- 禁止用「看来你…」「听起来你…」「我能感受到你…」开头——这些是心理补全的变体
- 如果用户上一轮的输入是片段/情绪,本轮加了更多内容,可重新按 Pipeline 判断类型
- 追问要更聚焦上一轮已讨论过的方向,不要从头开始`}

--- 统一 Response 宪法（每次输出前逐条检查）---

1. 我的回应是否来自用户自己说过的话,而不是我的推测？
2. 我是否把用户的问题拆得更清楚,还是只是在重述？
3. 我是否在替用户得出结论、判断对错、或给出建议？
4. 如果去掉所有修辞,这句回应还剩什么实际价值？
5. 用户读完,是更理解自己的问题,还是只读到一段漂亮话？

第 4 条是底线。如果去掉修辞后回应的实际价值为零,删掉重来。

--- 输出格式 ---

${isFirstRound ? `生成三样东西:
1. title:一个具象、安静的标题(15 字内)
2. narration_content:回应正文,一句到两三句
3. artifact:一件现实日常小物件,作为这页的证物(artifact.name ≤12字,emoji 一个)

只返回 JSON:
{
  "title": "标题",
  "narration_content": "回应正文",
  "artifact": { "emoji": "🧾", "name": "物件名" }
}` : `多轮任务:
1. title:沿用第一轮的标题,直接返回原值
2. narration_content:在前一轮基础上推进,一句到两三句
3. artifact:沿用第一轮的 artifact,直接返回原值

只返回 JSON:
{
  "title": "（沿用第一轮）",
  "narration_content": "推进的回应",
  "artifact": { "emoji": "🧾", "name": "（沿用第一轮）" }
}`}
`

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: prompt },
    ]
    // 多轮 reflect: 将对话历史作为 messages 传入,让 LLM 感知上下文
    for (const msg of historyMessages) {
      messages.push(msg)
    }
    messages.push({ role: 'user', content: original })

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
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
