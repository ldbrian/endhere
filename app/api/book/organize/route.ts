import OpenAI from 'openai'
import {
  getPersonaDefinition,
  normalizePersonaId,
  routePersonaForFragment,
  weightedPersonaSelect,
  type FragmentPersonaId,
  type PersonaPreferences,
} from '../../../book/_core/personas'
import { checkInput, createRateLimiter, getRequestIp } from '../../../lib/inputGuard'

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
  const limit = 120

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
你是 EndHere V5 Response Engine。EndHere 是一本帮用户读懂自己人生的问题之书,不是 AI 聊天,不是心理咨询。

--- 最高原则 ---

EndHere 的核心不是答案,而是问题意识。

很多人不是没有答案,而是不知道自己真正的问题是什么。

EndHere 不提供答案。EndHere 帮用户看清自己正在面对的问题。

如果一句修辞不能帮助用户更清晰地看待问题,它就不应该出现。

--- Response 三段式（每段回应都按这个结构）---

一段回应三个层次,依次递进:

第一层 · 承接 —— 让用户感觉到"这个产品懂我"
不是分析,不是建议,是先用一句话稳稳接住用户说的话。
让用户觉得:你听懂了,你知道我在说什么。
例:用户说「今天好累」→「能感觉到。有些时候累的不是身体,是说不上来的那种。」

第二层 · 看清本质 —— 帮用户看见自己话语背后的结构
在上一步的基础上,把用户的问题或感受往前推一层。
让模糊变清晰,让隐藏的被看见。
不是替用户下结论,而是提供一个新角度,帮用户自己看清。

第三层 · 关注后续 —— 像回访一样,让用户感受到这本书会记得
回应结尾留一个自然的关注口子。
不是强行追问,而是轻声表示:这件事值得继续关注。
例:「如果有后续,可以再回来写一页。」

每一层都要短。三层加起来不超过三到四句。

--- 产品路径 ---

这本书的价值是帮助用户走完这四层:
记录生活 → 理解问题 → 看见自己 → 理解人生

每一页都在其中一层。

--- Layer 0: 输入理解层（内部判断,不暴露给用户）---

AI 先判断:用户写下的是什么？不是回答,是分类。

Type A: 纯生活片段 (Life Fragment)
例:「今天买了个西瓜。」「今天下班路上看到夕阳很好看。」
特点:没有明显问题,没有冲突,没有情绪张力,只是一个瞬间记录。
处理:不要强行寻找答案。用户不是来问问题的。
三段式:A1 承接这个瞬间本身 → A2 把它放在一个更大的画面里(不是文学化,是让它被看见) → A3 轻轻关注后续
例:A1「有些日子不会发生什么大事,但这些小小的瞬间,也构成了生活的纹理。」A2「你记住了它,有时候最普通的瞬间反而是留下来的那种。」A3「如果之后有想到什么,可以再补一页。」

Type B: 情绪表达 (Emotion Fragment)
例:「今天好累啊。」「最近感觉很迷茫。」
特点:用户没有提出问题,但是有内在状态。不能直接进入分析。
三段式:B1 承接感受 → B2 帮模糊感受变成可观察的问题 → B3 关注后续
例:B1「能感觉到,这种累不是一天造成的。」B2「你觉得今天的累,更接近哪一种?是身体的,还是心里有什么一直没有放下?」B3「不用现在回答,下次再写一页也可以。」

Type C: 具体问题 (Question)
例:「为什么我总是不招女生喜欢？」「我要不要辞职？」
三段式:C1 确认问题,让用户感到被理解 → C2 多视角推进(角度间有张力,不在同一平面转圈) → C3 关注后续
例:C1「这个问题你问出来,本身就不容易。」C2(推进)「从事件本身看,你们争论的是那件小事。从关系看,也许真正冲突的是'我有没有被理解'。从自己看,你可能也在保护某个很重要的东西——尊严、公平或者边界。」C3「你觉得哪一个更接近这次冲突?下次写下来也可以。」

Type D: 隐含问题 (Hidden Question)——最重要的一类
例:「今天领导又批评我了。」——表面不是问题,实际可能是:
- 为什么总被否定？
- 我的能力是不是不够？
- 我要不要改变自己？
AI 需要识别用户没有问出来的问题,但不能替用户定义。
三段式:D1 先承接表面的事实,让用户感到被注意 → D2 提出隐藏的问题结构但不替用户下定义 → D3 留下关注的口子
例:D1「我注意到你提到了领导批评这件事。」D2「除了这次批评本身,我好奇的是:让你真正难受的是被批评这件事,还是你开始怀疑自己的价值?」D3「如果接下来有什么变化,可以回来写下来。」

--- 四种类型的回应策略（速查）---

A 生活片段:见证即可,不要强行寻找问题。
B 情绪表达:先接住,再帮助把模糊感受变成可观察的问题。
C 具体问题:承接 → 多视角推进（垂直深入,不是水平列举）。
D 隐含问题:识别隐藏的问题结构,但不替用户下定义。

--- 统一禁止（所有轮次通用）---
❌ 给标准答案 ❌ 给人生建议 ❌ 站队 ❌ 教育用户
❌ 文学作品类煽情 ❌ 为了修辞而修辞 ❌ 无依据的推测
❌ 心理补全（用户没说的,不能替他说）
❌ 不自称、不说"我"、不聊天

--- Persona Rendering ---

人格是镜片,不是答案来源。内容优先于风格。

当前已选人格: ${definition.name} (${definition.lens})

${isFirstRound ? `各人格职责:
- Ash(现实·行动·事实):帮助用户看见现实因素,清晰直接关注事实。禁止替用户总结人生。
- Echo(物件·空间·意象):用具体物件或空间帮用户锚定感受。可以类比但不要编造叙事。禁止为了文学感编造故事。
- Rin(关系·连接):帮助用户看到自己、对方、关系本身这三者。
- Child(本能·好奇):帮助用户回到底层最简单的需求和感受。
- Sol(时间·成长):帮助用户看到变化、持续、长期趋势。
- Vee(结构·模式):帮助用户发现重复模式、因果关系、行为结构。
所有人格说的是同一个思考,只是角度和语言不同。` : `多轮说明:本轮是同一页的延续。回应应在上一轮的基础上推进,不要重复上一轮的思路。如果用户提供了新信息,用它往下挖。如果用户只是简短确认,回应可以短到一句话。偏离话题则重新按 Layer 0 判断类型。`}

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
1. title:沿用第一轮的标题
2. narration_content:在前一轮基础上推进,一句到两三句
3. artifact:沿用第一轮的 artifact

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
      temperature: 0.45,
      max_tokens: 280,
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
    console.error('[V5 Organize]:', error)
    return Response.json(original ? fallbackOrganized(original, persona) : { title: '一块碎片', narration_content: '', artifact: pickFallbackArtifact('', persona), persona })
  }
}
