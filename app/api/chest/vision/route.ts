import OpenAI from 'openai'

export const runtime = 'edge'

// 阿里云 MaaS 视觉模型（qwen-vl）：彩蛋完成照片的内容安全 + 图片理解。
// 环境变量：DASHSCOPE_API_KEY / DASHSCOPE_BASE_URL（compatible-mode/v1）
let visionClient: OpenAI | null = null
function getVisionClient(): OpenAI | null {
  if (visionClient) return visionClient
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseURL = process.env.DASHSCOPE_BASE_URL
  if (!apiKey || !baseURL) return null
  visionClient = new OpenAI({ apiKey, baseURL })
  return visionClient
}

// 请求体上限保护：data URL 图片最多 ~4MB（前端已压缩到 ~500KB，此处防恶意大图）
const MAX_IMAGE_LEN = 6_000_000

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

type VisionResult = {
  safe: boolean
  risks: string[]
  description: string | null
  source: 'qwen' | 'degraded'
}

// 降级：无视觉模型 key 时不阻塞流程，标记为未审查（safe=true 但 risk 状态未知）
function degraded(): VisionResult {
  return { safe: true, risks: [], description: null, source: 'degraded' }
}

export async function POST(req: Request) {
  try {
    const client = getVisionClient()
    if (!client) {
      return Response.json(degraded(), { headers: corsHeaders() })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return Response.json({ error: 'EMPTY' }, { status: 400, headers: corsHeaders() })

    const image = typeof body.image === 'string' ? body.image.trim() : ''
    if (!image) return Response.json({ error: 'EMPTY' }, { status: 400, headers: corsHeaders() })
    if (image.length > MAX_IMAGE_LEN) {
      return Response.json({ safe: false, risks: ['图片过大'], description: null, source: 'qwen' }, { headers: corsHeaders() })
    }

    // 一次调用完成两件事：内容安全检查 + 图片内容理解。
    // 要求模型严格输出 JSON：先判断风险，再描述内容。风险项（如出现需列出）：
    // 人脸 / 车牌 / 身份证件 / 手机屏幕 / 地址门牌 / 其他隐私或违规内容。
    const sys = [
      '你是图片内容安全审查员。用户拍摄的是「生活彩蛋」的完成照片（可能在户外/室内拍到的物件、场景、风景）。',
      '请检查图片是否含以下风险，任何一项都要标出（不存在则留空数组）：',
      '- face：清晰可辨识的人脸',
      '- plate：车牌号',
      '- id_card：身份证/证件/护照',
      '- screen：手机屏幕/电脑屏幕（含他人隐私）',
      '- address：门牌号/地址/收件信息',
      '- other：其他明显隐私或违规内容（裸露、暴力、仇恨等）',
      '然后客观描述图片内容（用户在现实里发现了什么、看到了什么），30 字以内，不要联想解读、不要评价。',
      '只输出 JSON：{"safe":bool,"risks":["face|plate|id_card|screen|address|other",...],"description":"..."}',
    ].join('\n')

    const response = await client.chat.completions.create({
      model: 'qwen-vl-max',
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: [
            { type: 'text', text: '检查这张完成照片。' },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
    })

    const raw = response.choices[0]?.message?.content || ''
    const parsed = safeJsonParse(raw)

    const risks = Array.isArray(parsed?.risks) ? (parsed.risks as string[]).filter((r) => typeof r === 'string') : []
    const description = typeof parsed?.description === 'string' ? parsed.description.slice(0, 80) : null
    const safe = parsed?.safe === true || (risks.length === 0 && description !== null)

    return Response.json({ safe, risks, description, source: 'qwen' }, { headers: corsHeaders() })
  } catch (error) {
    console.error('[Chest Vision]:', error)
    // 视觉服务异常：标记为未审查降级，不阻断用户流程
    return Response.json(degraded(), { headers: corsHeaders() })
  }
}

// 鲁棒 JSON 解析：qwen 偶发输出非严格 JSON（代码块/尾逗号）
function safeJsonParse(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) return null
  let candidate = cleaned.slice(start, end + 1)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}