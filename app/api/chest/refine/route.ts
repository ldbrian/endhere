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
  'name 是给物件起的一个有画面感的短名（≤10字）、meaning 是用一句话解释它在这个时刻意味着什么、desc 是一句收尾文案（不要升华说教）。'

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
    if (messages.length === 0) return Response.json({ error: 'EMPTY' }, { status: 400, headers: corsHeaders() })

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
    if (!llm || process.env.CHEST_MOCK === '1') {
      return Response.json(
        final
          ? buildLocalResult({ persona, emotion, salt })
          : { type: 'reply', reply: fallbackReply(persona) },
        { headers: corsHeaders() },
      )
    }

    const me = CHEST_PERSONAS[persona]
    const system = [
      me.system,
      `当前情绪：${emotion?.state || '未知'}，强度 ${emotion?.score ?? 5}/10。`,
      final
        ? `这是本轮的最后一句。请同时给出：一句收尾回应（延续你的人格）、一个行动彩蛋（你人格风格的行事方式）、以及${OBJECT_PROMPT}`
        : '请先用一句话回应。不要替用户下结论，不要给长篇建议。',
      '只输出 JSON。',
    ].join('\n')

    const finalSchema = '{"type":"result","reply":"…","title":"≤10字标题","egg":{"text":"行动建议"},"object":{"id":"池内id","name":"≤10字","meaning":"一句话寓意","desc":"收尾文案"}}'
    const replySchema = '{"type":"reply","reply":"一句话回应"}'
    const user = [...messages.map((m) => `${m.role === 'assistant' ? '你' : '对方'}：${m.content}`), final ? `对方：${messages[messages.length - 1]?.content}` : ''].join('\n')

    const response = await llm.chat.completions.create({
      model: 'deepseek-chat',
      temperature: final ? 0.8 : 0.7,
      max_tokens: final ? 500 : 220,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user + '\n\n请严格输出：' + (final ? finalSchema : replySchema) },
      ],
    })

    const raw = response.choices[0]?.message?.content || ''
    const parsed = safeJsonParse(raw) || {} as Record<string, unknown>

    if (parsed.type !== 'result') {
      return Response.json({
        type: 'reply',
        reply: String(parsed.reply || fallbackReply(persona)).slice(0, 120),
      }, { headers: corsHeaders() })
    }

    const egg = pickFallbackEgg(persona, emotion, salt)
    let object = pickFallbackObject(persona, emotion, salt)
    const objRaw = parsed.object
    const objId = objRaw && typeof objRaw === 'object'
      ? String((objRaw as Record<string, unknown>).id || '')
      : ''
    const matched = CHEST_OBJECTS.find((o) => o.id === objId)
    if (matched) object = matched
    const objFields = objRaw && typeof objRaw === 'object' ? objRaw as Record<string, unknown> : {}
    const eggRaw = parsed.egg && typeof parsed.egg === 'object' ? parsed.egg as Record<string, unknown> : {}

    return Response.json({
      type: 'result',
      reply: String(parsed.reply || me.greeting).slice(0, 140),
      title: String(parsed.title || titleFromEmotion(emotion)).slice(0, 10),
      egg: { id: egg.id, text: String(eggRaw.text || egg.text).slice(0, 60) },
      object: {
        id: object.id,
        name: String(objFields.name || object.baseName).slice(0, 10),
        meaning: String(objFields.meaning || object.baseMeaning).slice(0, 24),
        desc: String(objFields.desc || `${object.baseName}——${object.baseMeaning}。`).slice(0, 60),
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
