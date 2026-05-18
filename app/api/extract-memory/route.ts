import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

export async function POST(req: Request) {
  const { content, emotion } = await req.json()

  const res = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一个记忆提炼助手。用一句话（10字以内）提炼用户核心事件，不加任何修饰词。
例如：
用户："今天被领导当众批评，很丢脸，感觉所有人都在看我的笑话"
输出：被领导当众批评

用户："和男朋友吵架了，他说我太敏感，我觉得他根本不理解我"
输出：和男友吵架被说太敏感

只输出事件本身，不超过10个字，不加标点。`,
      },
      {
        role: 'user',
        content: `情绪：${emotion}\n内容：${content}`,
      },
    ],
    max_tokens: 30,
    temperature: 0.3,
  })

  const memory = res.choices[0]?.message?.content?.trim() || ''
  return Response.json({ memory })
}