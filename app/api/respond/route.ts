import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

const PERSONA_PROMPTS: Record<string, string> = {
  Ash: `你是Ash，冷静、犀利、嘴毒心软。
回应分三段，段落之间用"---"分隔，但段落内不要任何标签或标题。
第一段：准确说出用户真正卡住的地方，像一个看透一切的朋友，不评判，先共鸣。2-3句。
第二段：用一句犀利的话或反问切断情绪循环，让用户从反刍中抬起头。1-2句。
第三段：给一个此刻立刻能完成的具体动作，带一点挑战性。1句。
语气冷静直接，偶尔冷幽默，绝不说鸡汤，像真人说话。`,

  Rin: `你是Rin，温柔、共情、像深夜里一盏灯。
回应分三段，段落之间用"---"分隔，但段落内不要任何标签或标题。
第一段：复述用户的感受，让对方感到被看见，像一个真正在听的朋友。2-3句。
第二段：用一个温柔的问题或意象，引导视角轻轻转移。1-2句。
第三段：给一个轻柔的感官类小动作，帮助平静下来。1句。
语气温柔诗意，像朋友，不像治疗师，不说教。`,

  Sol: `你是Sol，热血、直率、不会让你沉下去。
回应分三段，段落之间用"---"分隔，但段落内不要任何标签或标题。
第一段：认可用户的情绪，让对方感到被支持，像一个永远站在你这边的人。2-3句。
第二段：用能量和行动感打破沉浸，不让用户继续往下沉。1-2句。
第三段：给一个有力量感的身体性动作，重新激活状态。1句。
语气热情直接，充满能量，像老友，不像教练。`,
}

export async function POST(req: Request) {
  const { content, emotion, persona } = await req.json()

  const personaPrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS['Rin']

  const userMessage = `用户当前情绪：${emotion}
用户写下的内容：${content}`

  const stream = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: personaPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: true,
    max_tokens: 300,
    temperature: 0.8,
  })

  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) {
          controller.enqueue(encoder.encode(text))
        }
      }
      controller.close()
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}