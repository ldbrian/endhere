import OpenAI from 'openai'
import { checkInput, createRateLimiter, getRequestIp } from '../../../lib/inputGuard'
import {
  CHEST_OBJECTS,
  CHEST_PERSONAS,
  buildLocalResult,
  fallbackReply,
  pickFallbackEgg,
  pickFallbackObject,
  seed,
  titleFromEmotion,
  type ChestPersonaId,
} from '../_pools'

export const runtime = 'edge'

// 同一 IP 每分钟最多 20 次：对话多轮场景比 organize 更频，但防止脚本狂灌
const chestLimiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 })

// 第几个用户回合后 AI 开始考虑「进入下一阶段」（offer）；用户可强制继续突破
const OFFER_AFTER = 3

// 惰性创建 OpenAI 客户端：环境变量缺失时返回 null，路由走兜底，而不是模块加载即 500
let openaiClient: OpenAI | null = null
function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseURL = process.env.DEEPSEEK_BASE_URL
  if (!apiKey || !baseURL) return null
  openaiClient = new OpenAI({ apiKey, baseURL })
  return openaiClient
}

type EmotionLike = { state?: string | null; score?: number | null }
type ChatMsg = { role: 'user' | 'assistant'; content: string }

const OBJECT_PROMPT =
  '从物件池里选一个最贴合用户此刻状态的物件，并生成它的今日解释。' +
  '物件池：' + CHEST_OBJECTS.map((o) => o.id + '·' + o.baseMeaning).join('；') + '。' +
  'name 是给物件起的一个有画面感的短名（中文≤10字）、meaning 是用一句话解释它在这个时刻意味着什么、desc 是一句收尾文案（不要升华说教）。'

// 本接口只服务 BeginHere 子域；CORS 白名单在生产由环境变量控制
function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.CHEST_CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

function extractJsonObject(raw: string) {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('No JSON object in chest refine response')
  return cleaned.slice(start, end + 1)
}

// 鲁棒 JSON 解析：DeepSeek 偶发输出不严格合法 JSON（尾逗号 / 单引号 / 未转义换行 / 前导注释），直接 JSON.parse 会炸
function safeJsonParse(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(extractJsonObject(raw))
  } catch {
    // 去掉可能混入的注释行，再试着修复常见不合法点
  }
  const cleaned = raw
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) return null
  let candidate = cleaned.slice(start, end + 1)
    // 控制字符（如未转义换行出现在字符串值里）
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    // 尾逗号：,} 和 ,]
    .replace(/,\s*([}\]])/g, '$1')
  // JSON 标准不允许单引号；按最简单情况把单引号字符替换为双引号（值内不包含转义单引号的场景）
  candidate = candidate.replace(/'(?=\s*:)/g, '"').replace(/'(?=\s*[,}])/g, '"')
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function normalizePersona(value: unknown): ChestPersonaId {
  const v = String(value || '')
  return v === 'Ash' || v === 'Child' ? v : v === 'Rin' ? 'Rin' : 'Rin'
}

// 截断按语言区分：中文按字（上限小），英文按字符（词汇更长，上限需放大）
// zh 与 en 的参数顺序：cut(text, lang, zhMax, enMax)
function cut(text: string, lang: string, zhMax: number, enMax: number): string {
  const max = lang === 'en' ? enMax : zhMax
  return text.slice(0, max)
}

export async function POST(req: Request) {
  let persona: ChestPersonaId = 'Rin'
  let emotion: EmotionLike = {}
  let final = false
  // 设备级盐：同设备同角色同日期时降级物件/彩蛋稳定（每日确定性）
  const salt = req.headers.get('x-device-id')?.trim() || req.headers.get('eh_device_id')?.trim() || undefined

  try {
    const ip = getRequestIp(req)
    if (!chestLimiter.check(ip)) {
      return Response.json(buildLocalResult({ persona, emotion, salt }), { status: 429, headers: corsHeaders() })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return Response.json({ error: 'EMPTY' }, { status: 400, headers: corsHeaders() })

    persona = normalizePersona(body.persona)
    const emotionRaw = body.emotion
    if (emotionRaw && typeof emotionRaw === 'object') {
      const e = emotionRaw as Record<string, unknown>
      emotion = {
        state: typeof e.state === 'string' ? e.state : '',
        score: typeof e.score === 'number' ? e.score : 5,
      }
    }
    final = body.final === true
    const mode = body.mode === 'egg' ? 'egg' : 'chat'
    // 用户点「我还想聊聊」强制继续：即使达到 offer 阈值也只回普通回复，不出 offer/不结束
    const forceContinue = body.forceContinue === true
    // 语言：BeginHere 传 lang='en' 时整段对话（含 title/name/meaning/desc/egg）全用英文
    const lang = body.lang === 'en' ? 'en' : 'zh'

    const rawMessages = Array.isArray(body.messages) ? body.messages : []
    const messages: ChatMsg[] = []
    for (const entry of rawMessages) {
      if (entry && typeof entry === 'object') {
        const r = entry as Record<string, unknown>
        if (typeof r.content === 'string' && (r.role === 'user' || r.role === 'assistant')) {
          messages.push({ role: r.role, content: r.content })
        }
      }
    }
    if (messages.length === 0 && mode !== 'egg') return Response.json({ error: 'EMPTY' }, { status: 400, headers: corsHeaders() })

    // 敏感词命中：静默降级而非暴露拦截事实；超长直接 400
    for (const m of messages) {
      const guard = checkInput(m.content, { max: 2000 })
      if (!guard.ok) {
        if (guard.reason === 'BLOCKED_CONTENT') {
          return Response.json(buildLocalResult({ persona, emotion, salt }), { headers: corsHeaders() })
        }
        return Response.json({ error: guard.reason }, { status: 400, headers: corsHeaders() })
      }
    }

    // ── AI 降级闸：无 key / mock 环境 → 本地模板，流程永不中断
    const llm = getOpenAIClient()
    const userTurns = messages.filter((m) => m.role === 'user').length

    if (!llm || process.env.CHEST_MOCK === '1') {
      if (mode === 'egg' && !final) {
        const egg = pickFallbackEgg(persona, emotion, salt)
        return Response.json({ type: 'result', egg: { id: egg.id, text: egg.text } }, { headers: corsHeaders() })
      }
      if (mode === 'egg' && final) {
        const obj = pickFallbackObject(persona, emotion, salt)
        return Response.json({
          type: 'result',
          reply: CHEST_PERSONAS[persona]?.greeting || '嗯。',
          title: titleFromEmotion(emotion),
          object: {
            id: obj.id,
            name: obj.baseName,
            meaning: obj.baseMeaning,
            desc: `${obj.baseName}——${obj.baseMeaning}。`,
          },
        }, { headers: corsHeaders() })
      }
      if (final) return Response.json(buildLocalResult({ persona, emotion, salt }), { headers: corsHeaders() })
      if (!forceContinue && userTurns >= OFFER_AFTER) {
        const egg = pickFallbackEgg(persona, emotion, salt)
        return Response.json({
          type: 'offer',
          reply: CHEST_PERSONAS[persona]?.greeting || '嗯。',
          egg: { id: egg.id, text: egg.text },
        }, { headers: corsHeaders() })
      }
      return Response.json({ type: 'reply', reply: fallbackReply(persona) }, { headers: corsHeaders() })
    }

    // 服务端兜底（本地模板分支已处理所有态，无需重复）；以下为 LLM 路径
    const me = CHEST_PERSONAS[persona]
    const isEggReceipt = mode === 'egg' && final
    const isEggFresh = mode === 'egg' && !final
    const isOffer = !final && !forceContinue && userTurns >= OFFER_AFTER && !isEggFresh

    const system = [
      me.system,
      `当前情绪：${emotion?.state || '未知'}，强度 ${emotion?.score ?? 5}/10。`,
      isEggFresh
        ? '这是探索行动彩蛋。请只给一个符合你人格风格、可在现实生活中执行的小行动（1句话，具体、不费力）。'
        : isEggReceipt
        ? '用户完成了一个生活彩蛋并回来反馈。请给一句温柔的收尾认可，并生成一件象征这次体验的小票物件。'
        : final
        ? `用户主动结束倾诉。请给出：一句收尾回应（延续你的人格）、以及${OBJECT_PROMPT}。不要给行动彩蛋。`
        : isOffer
        ? `可以先进入下一阶段了。请给一句：对当前情绪承接/总结，并给出一个符合你人格风格的生活彩蛋建议（1句话，具体、不费力）。注意这不是强制结束，只是"可以进入下一阶段"。`
        : '请先用一句话回应。不要替用户下结论，不要给长篇建议。',
      lang === 'en'
        ? 'The user uses English. Reply entirely in English: the reply text, egg text, object title, name, meaning and desc must all be in English. Output ONLY the JSON object. In English, title and name should be short (2-5 words), meaning one clear sentence, desc one closing line. ' + '只输出 JSON。'
        : '只输出 JSON。',
    ].join('\n')

    const receiptSchema = lang === 'en'
      ? '{"type":"result","reply":"…","title":"short title","object":{"id":"pool id","name":"short name","meaning":"one-sentence meaning","desc":"one closing line"}}'
      : '{"type":"result","reply":"…","title":"≤10字标题","object":{"id":"池内id","name":"≤10字","meaning":"一句话寓意","desc":"收尾文案"}}'
    const eggSchema = '{"type":"result","egg":{"text":"一个生活小行动"}}'
    const offerSchema = '{"type":"offer","reply":"一句情绪承接/总结","egg":{"text":"一个生活彩蛋建议"}}'
    const replySchema = '{"type":"reply","reply":"一句话回应"}'
    const user = [...messages.map((m) => `${m.role === 'assistant' ? '你' : '对方'}：${m.content}`), final ? `对方：${messages[messages.length - 1]?.content}` : ''].join('\n')

    let outSchema = replySchema
    if (isEggFresh) outSchema = eggSchema
    else if (isEggReceipt || final) outSchema = receiptSchema
    else if (isOffer) outSchema = offerSchema

    const response = await llm.chat.completions.create({
      model: 'deepseek-chat',
      temperature: isEggFresh ? 0.9 : final ? 0.8 : 0.7,
      max_tokens: isEggFresh ? 120 : final ? 500 : 220,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user + '\n\n请严格输出：' + outSchema },
      ],
    })

    const raw = response.choices[0]?.message?.content || ''
    const parsed = safeJsonParse(raw) || {} as Record<string, unknown>

    // ── 探索路径：只回行动彩蛋，无情绪小票/物件 ──
    if (isEggFresh) {
      const egg = pickFallbackEgg(persona, emotion, salt)
      const eggRaw = parsed.egg && typeof parsed.egg === 'object' ? parsed.egg as Record<string, unknown> : {}
      return Response.json({
        type: 'result',
        egg: {
          id: egg.id,
          text: cut(String(eggRaw.text || egg.text), lang, 60, 140),
        },
      }, { headers: corsHeaders() })
    }

    // ── offer：AI 判断可进入下一阶段，给承接 + 彩蛋建议（一次返回） ──
    if (isOffer) {
      const egg = pickFallbackEgg(persona, emotion, salt)
      const eggRaw = parsed.egg && typeof parsed.egg === 'object' ? parsed.egg as Record<string, unknown> : {}
      return Response.json({
        type: 'offer',
        reply: cut(String(parsed.reply || me.greeting), lang, 140, 400),
        egg: {
          id: egg.id,
          text: cut(String(eggRaw.text || egg.text), lang, 60, 140),
        },
      }, { headers: corsHeaders() })
    }

    if (parsed.type !== 'result') {
      return Response.json({
        type: 'reply',
        reply: cut(String(parsed.reply || fallbackReply(persona)), lang, 120, 400),
      }, { headers: corsHeaders() })
    }

    let object = pickFallbackObject(persona, emotion, salt)
    const objRaw = parsed.object
    const objId = objRaw && typeof objRaw === 'object'
      ? String((objRaw as Record<string, unknown>).id || '')
      : ''
    const matched = CHEST_OBJECTS.find((o) => o.id === objId)
    if (matched) object = matched
    const objFields = objRaw && typeof objRaw === 'object' ? objRaw as Record<string, unknown> : {}

    return Response.json({
      type: 'result',
      reply: cut(String(parsed.reply || me.greeting), lang, 140, 400),
      title: cut(String(parsed.title || titleFromEmotion(emotion)), lang, 10, 30),
      object: {
        id: object.id,
        name: cut(String((objFields as Record<string, unknown>).name || object.baseName), lang, 10, 30),
        meaning: cut(String((objFields as Record<string, unknown>).meaning || object.baseMeaning), lang, 24, 80),
        desc: cut(String((objFields as Record<string, unknown>).desc || `${object.baseName}——${object.baseMeaning}。`), lang, 60, 160),
      },
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('[Chest Refine]:', error)
    return Response.json(
      final ? buildLocalResult({ persona, emotion, salt }) : { type: 'reply', reply: fallbackReply(persona) },
      { headers: corsHeaders() },
    )
  }
}
