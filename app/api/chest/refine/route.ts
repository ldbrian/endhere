import OpenAI from 'openai'
import { checkInput, createRateLimiter, getRequestIp } from '../../../lib/inputGuard'
import {
  CHEST_PERSONAS,
  CHEST_EGG_ADJUST,
  buildLocalReceipt,
  fallbackReply,
  pickFallbackEgg,
  pickEggChoice,
  pickEggForSituation,
  titleFromEmotion,
  detectCrisis,
  CRISIS_REPLIES,
  type ChestPersonaId,
  type EggDef,
  type SituationInput,
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
  // 20s 上限 + 不重试：DeepSeek 偶发慢，SDK 默认会重试 2 次，一次请求被叠成 ~30s，
  // 用户感知就是「卡住不动」。关掉重试、给硬超时，慢就快速降级，不拖着不回应。
  openaiClient = new OpenAI({ apiKey, baseURL, timeout: 20000, maxRetries: 0 })
  return openaiClient
}

type EmotionLike = { state?: string | null; score?: number | null }
type ChatMsg = { role: 'user' | 'assistant'; content: string }

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

// 渐进式陪伴蛋（带 steps）返回完整池子字段，不走 LLM 重写——保证步骤与文案一致、可恢复
function eggPayload(egg: EggDef): Record<string, unknown> {
  const p: Record<string, unknown> = { id: egg.id, text: egg.text }
  if (egg.steps?.length) {
    p.steps = egg.steps
    if (egg.difficulty) p.difficulty = egg.difficulty
    if (egg.estimated_duration) p.estimated_duration = egg.estimated_duration
  }
  // 参考答案的变体建议：用户可自己调整方向
  if (CHEST_EGG_ADJUST[egg.id]) p.adjust = CHEST_EGG_ADJUST[egg.id]
  return p
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
  // 换一个彩蛋（replaceNonce）会追加随机段重新播种，让同一天也能换出不同的蛋
  const baseSalt = req.headers.get('x-device-id')?.trim() || req.headers.get('eh_device_id')?.trim() || undefined
  let salt = baseSalt

  try {
    const ip = getRequestIp(req)
    if (!chestLimiter.check(ip)) {
      return Response.json({ type: 'reply', reply: fallbackReply(persona) }, { status: 429, headers: corsHeaders() })
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
    // 完成蛋收尾：只做安全检测（危机/敏感词），不调 LLM、不生成物件。
    // 命中危机时上面的安全层已经返回；这里只回一个空 reply，前端用本地小票。
    const safetyOnly = body.safetyOnly === true
    // 用户点「我还想聊聊」强制继续：即使达到 offer 阈值也只回普通回复，不出 offer/不结束
    const forceContinue = body.forceContinue === true
    // 场景分流 hint：BeginHere 按本地时段发（夜晚=indoor），决定给蛋时避开「要出门」的
    const place: 'indoor' | 'any' = body.place === 'indoor' ? 'indoor' : 'any'
    // 情境彩蛋：用户告诉「此刻我在哪/多久/能不能动」，按情境匹配一颗更做得成的蛋
    let situation: SituationInput | undefined
    const sRaw = body.situation
    if (sRaw && typeof sRaw === 'object') {
      const s = sRaw as Record<string, unknown>
      const scene = String(s.scene || '')
      if (['home', 'out', 'commute', 'meal', 'wait', 'work'].includes(scene)) {
        situation = { scene: scene as SituationInput['scene'] }
        const t = String(s.time || '')
        if (['short', 'medium', 'long'].includes(t)) situation.time = t as SituationInput['time']
        const a = String(s.action || '')
        if (['walk', 'stay', 'hands_off'].includes(a)) situation.action = a as SituationInput['action']
      }
    }
    // 换一个彩蛋：nonce 追加进盐，重播种当日随机源，避免换出同一颗蛋
    if (body.replaceNonce && typeof body.replaceNonce === 'string' && body.replaceNonce.length > 0 && body.replaceNonce.length <= 40) {
      salt = baseSalt ? `${baseSalt}|r${body.replaceNonce}` : `r${body.replaceNonce}`
    }
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

    // ── 危机安全层：命中自杀/自伤信号 → 绕过人格与所有游戏机制，改为引导求助 ──
    // 必须在 checkInput 之前：危机词不应被当成普通敏感词静默降级成「生活碎片」
    const crisisLevel = detectCrisis(messages)
    if (crisisLevel) {
      const text = CRISIS_REPLIES[crisisLevel][lang === 'en' ? 'en' : 'zh']
      return Response.json({ type: 'crisis', level: crisisLevel, reply: text }, { headers: corsHeaders() })
    }

    // 敏感词命中：静默降级而非暴露拦截事实；超长直接 400
    for (const m of messages) {
      const guard = checkInput(m.content, { max: 2000 })
      if (!guard.ok) {
        if (guard.reason === 'BLOCKED_CONTENT') {
          if (final) {
            const local = buildLocalReceipt({ persona, emotion })
            return Response.json({ type: 'result', reply: local.reply, title: local.title }, { headers: corsHeaders() })
          }
          return Response.json({ type: 'reply', reply: fallbackReply(persona) }, { headers: corsHeaders() })
        }
        return Response.json({ error: guard.reason }, { status: 400, headers: corsHeaders() })
      }
    }

    if (safetyOnly) {
      return Response.json({ type: 'reply', reply: '' }, { headers: corsHeaders() })
    }

    // ── 探索路径（彩蛋）：直出池子原文，永不调用 LLM ──
    // 蛋文案是人工写死在 _pools.ts 的，AI 只做「润色」不值当：冷启动 + 生成要等好几秒，
    // 抽蛋第一印象就是等。这里直接返回池子，保证瞬时响应，且文案与池子逐字一致。
    if (mode === 'egg' && !final) {
      // 每日三选一（P1 A）：body.count>=2 时一次给多颗，供用户从中挑一颗当天的蛋；
      // 单颗请求（count 缺省/1）保持原行为，广场 hero / 聊天 offer 完全不受影响。
      const wantCount =
        typeof body.count === 'number' && body.count >= 2 && body.count <= 5 ? Math.floor(body.count) : 0
      if (wantCount) {
        const eggs = pickEggChoice(persona, emotion, salt, place, wantCount)
        return Response.json({ type: 'result', eggs: eggs.map(eggPayload) }, { headers: corsHeaders() })
      }
      const egg = situation
        ? pickEggForSituation(persona, salt, situation)
        : pickFallbackEgg(persona, emotion, salt, place)
      return Response.json({ type: 'result', egg: eggPayload(egg) }, { headers: corsHeaders() })
    }

    // ── AI 降级闸：无 key / mock 环境 → 本地模板，流程永不中断
    const llm = getOpenAIClient()
    const userTurns = messages.filter((m) => m.role === 'user').length

    if (!llm || process.env.CHEST_MOCK === '1') {
      if (final) {
        const local = buildLocalReceipt({ persona, emotion })
        return Response.json({ type: 'result', reply: local.reply, title: local.title }, { headers: corsHeaders() })
      }
      if (!forceContinue && userTurns >= OFFER_AFTER) {
        const egg = pickFallbackEgg(persona, emotion, salt, place)
        return Response.json({
          type: 'offer',
          reply: CHEST_PERSONAS[persona]?.greeting || '嗯。',
          egg: eggPayload(egg),
        }, { headers: corsHeaders() })
      }
      return Response.json({ type: 'reply', reply: fallbackReply(persona) }, { headers: corsHeaders() })
    }

    // 服务端兜底（本地模板分支已处理所有态，无需重复）；以下为 LLM 路径
    const me = CHEST_PERSONAS[persona]
    const isEggReceipt = mode === 'egg' && final
    const isOffer = !final && !forceContinue && userTurns >= OFFER_AFTER

    const system = [
      me.system,
      `当前情绪：${emotion?.state || '未知'}，强度 ${emotion?.score ?? 5}/10。`,
      place === 'indoor' && isOffer
        ? '场景约束：现在是深夜、你在家。给的小行动必须不需要出门、现在就能完成（比如听歌、写一段话、整理一件旧物、做一个几秒钟的小动作）。不要给出门/通勤/买东西/见人的行动。'
        : '',
      isEggReceipt
        ? '用户完成了一个生活彩蛋并回来反馈（输入包含彩蛋原文、完成状态与感受）。请基于「这次真实发生的行动」给一句轻量、具体的回应：看见用户真的做了一件小事，回应里带上这件小事本身（不要泛泛而谈、不要教育、不要分析深层心理、不要变成心理咨询）。不要生成物件。'
        : final
        ? '用户主动结束倾诉。请给出：一句收尾回应（延续你的人格）。不要给行动彩蛋，也不要生成物件。'
        : isOffer
        ? `可以先进入下一阶段了。请给一句：对当前情绪承接/总结，并给出一个符合你人格风格的生活彩蛋建议（1句话，具体、不费力）。注意这不是强制结束，只是"可以进入下一阶段"。`
        : '请先用一句话回应。不要替用户下结论，不要给长篇建议。',
      lang === 'en'
        ? 'The user uses English. Reply entirely in English: the reply text and title must be in English. Output ONLY the JSON object. In English, title should be short (2-5 words). ' + '只输出 JSON。'
        : '只输出 JSON。',
    ].join('\n')

    const receiptSchema = lang === 'en'
      ? '{"type":"result","reply":"…","title":"short title"}'
      : '{"type":"result","reply":"…","title":"≤10字标题"}'
    const offerSchema = '{"type":"offer","reply":"一句情绪承接/总结","egg":{"text":"一个生活彩蛋建议"}}'
    const replySchema = '{"type":"reply","reply":"一句话回应"}'
    const user = [...messages.map((m) => `${m.role === 'assistant' ? '你' : '对方'}：${m.content}`), final ? `对方：${messages[messages.length - 1]?.content}` : ''].join('\n')

    let outSchema = replySchema
    if (isEggReceipt || final) outSchema = receiptSchema
    else if (isOffer) outSchema = offerSchema

    // ── 流式回复（P0.5）：聊天轮次逐字返回，首字立刻出现 ──
    // 只对「聊天回复 / offer 承接」生效；最终小票（result）仍走整包 JSON，因为它要跳转物件页。
    // 说人话：模型吐一个字，前端就显示一个字，用户不再盯着省略号干等。
    if (body.stream === true && !final && !isEggReceipt) {
      const streamSystem = [
        me.system,
        `当前情绪：${emotion?.state || '未知'}，强度 ${emotion?.score ?? 5}/10。`,
        place === 'indoor' && isOffer
          ? '场景约束：现在是深夜、你在家。给的小行动必须不需要出门、现在就能完成。'
          : '',
        isOffer
          ? '先给一句对当前情绪的承接/总结（1~2 句），不要给行动建议本身。'
          : '只回应对方。不要替用户下结论，不要给长篇建议。',
        '直接输出你要说的那句话本身：不要 JSON、不要引号、不要「回复：」之类前缀。',
      ].join('\n')
      const streamUser = [...messages.map((m) => `${m.role === 'assistant' ? '你' : '对方'}：${m.content}`)].join('\n')
      const stream = await llm.chat.completions.create({
        model: 'deepseek-chat',
        temperature: 0.7,
        max_tokens: isOffer ? 300 : 220,
        stream: true,
        messages: [
          { role: 'system', content: streamSystem },
          { role: 'user', content: streamUser },
        ],
      })
      const streamEgg = isOffer ? pickFallbackEgg(persona, emotion, salt, place) : null
      const encoder = new TextEncoder()
      const sse = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
          try {
            for await (const chunk of stream) {
              const delta = chunk.choices?.[0]?.delta?.content || ''
              if (delta) send({ delta })
            }
            send({ done: true, offer: streamEgg ? eggPayload(streamEgg) : null })
          } catch (e) {
            console.error('[Chest Stream]:', e)
            send({ done: true, offer: streamEgg ? eggPayload(streamEgg) : null, error: true })
          } finally {
            controller.close()
          }
        },
      })
      return new Response(sse, {
        headers: {
          ...corsHeaders(),
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    const response = await llm.chat.completions.create({
      model: 'deepseek-chat',
      temperature: final ? 0.8 : 0.7,
      max_tokens: final ? 500 : 220,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user + '\n\n请严格输出：' + outSchema },
      ],
    })

    const raw = response.choices[0]?.message?.content || ''
    const parsed = safeJsonParse(raw) || {} as Record<string, unknown>

    // ── offer：AI 判断可进入下一阶段，给承接 + 彩蛋建议（一次返回） ──
    // 彩蛋统一取池子原文（含 steps/adjust），不再让 AI 重写蛋文案——回复走 AI，蛋永远是池子原话。
    if (isOffer) {
      const egg = pickFallbackEgg(persona, emotion, salt, place)
      return Response.json({
        type: 'offer',
        reply: cut(String(parsed.reply || me.greeting), lang, 140, 400),
        egg: eggPayload(egg),
      }, { headers: corsHeaders() })
    }

    if (parsed.type !== 'result') {
      return Response.json({
        type: 'reply',
        reply: cut(String(parsed.reply || fallbackReply(persona)), lang, 120, 400),
      }, { headers: corsHeaders() })
    }

    return Response.json({
      type: 'result',
      reply: cut(String(parsed.reply || me.greeting), lang, 140, 400),
      title: cut(String(parsed.title || titleFromEmotion(emotion)), lang, 10, 30),
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('[Chest Refine]:', error)
    if (final) {
      const local = buildLocalReceipt({ persona, emotion })
      return Response.json({ type: 'result', reply: local.reply, title: local.title }, { headers: corsHeaders() })
    }
    return Response.json({ type: 'reply', reply: fallbackReply(persona) }, { headers: corsHeaders() })
  }
}
