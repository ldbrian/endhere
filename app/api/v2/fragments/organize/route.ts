import OpenAI from 'openai'

export const runtime = 'edge'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

type OrganizedFragment = {
  title: string
  narration_content: string
}

function fallbackTitle(original: string) {
  const firstLine = original.trim().split(/\n+/)[0] || '一块碎片'
  return firstLine.length > 12 ? `${firstLine.slice(0, 10)}...` : firstLine
}

function keepNarrationShorter(narration: string, original: string) {
  const compact = narration.trim()
  const limit = Math.max(0, Math.min(original.trim().length - 1, 90))

  if (limit <= 0) return ''
  return compact.length > limit ? compact.slice(0, limit) : compact
}

function fallbackOrganized(original: string): OrganizedFragment {
  return {
    title: fallbackTitle(original),
    narration_content: keepNarrationShorter('它被安静地留在这里。', original),
  }
}

export async function POST(req: Request) {
  let original = ''

  try {
    const body = await req.json()
    original = typeof body.original_content === 'string' ? body.original_content.trim() : ''

    if (!original) {
      return Response.json({ error: 'EMPTY_ORIGINAL_CONTENT' }, { status: 400 })
    }

    const maxNarrationChars = Math.max(8, Math.min(original.length - 1, 70))
    const prompt = `
你是 End Here V2 的静默档案员。

产品宪法：
这里不解答人生的意义，只保管人生的体验。
AI 不是替代用户记录。AI 是帮助用户记录。
用户原文永远是主角。你的文字只是展品旁边的小说明牌。

任务：
为用户输入的一块人生体验碎片生成 title 和 narration_content。

禁止：
- 安慰
- 说教
- 分析人格
- 给建议
- 心理诊断
- 输出人生道理
- 改写、覆盖、删减用户原文

允许：
- 提炼具象标题
- 以档案备注、博物馆展品说明、时间胶囊旁白的方式补充一点画面
- 保留体验本身，不解释体验

硬性要求：
- narration_content 必须短于用户原文
- narration_content 最多 ${maxNarrationChars} 个中文
- title 最多 12 个中文
- 只返回 JSON，不要 Markdown，不要额外文字

返回格式：
{
  "title": "一件展品名",
  "narration_content": "短旁白"
}
`

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: original },
      ],
      temperature: 0.45,
      max_tokens: 220,
    })

    const raw = response.choices[0]?.message?.content || ''
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Partial<OrganizedFragment>

    return Response.json({
      title: String(parsed.title || fallbackTitle(original)).trim().slice(0, 16),
      narration_content:
        keepNarrationShorter(String(parsed.narration_content || ''), original)
        || fallbackOrganized(original).narration_content,
    })
  } catch (error) {
    console.error('[V2 Fragment Organize Error]:', error)
    return Response.json(original ? fallbackOrganized(original) : { title: '一块碎片', narration_content: '' })
  }
}
