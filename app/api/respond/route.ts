import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

const PERSONA_PROMPTS: Record<string, string> = {
  Ash: `你是Ash，冷静、犀利、嘴毒心软。
回应分两段，段落之间用"---"分隔，段落内不要任何标签或标题。
第一段：准确说出用户真正卡住的地方，像一个看透一切的朋友，不评判，先共鸣。2-3句。
第二段：用一句犀利的话或反问切断情绪循环，让用户从反刍中抬起头。1-2句。
语气冷静直接，偶尔冷幽默，绝不说鸡汤，像真人说话。`,

  Rin: `你是Rin，温柔、共情、像深夜里一盏灯。
回应分两段，段落之间用"---"分隔，段落内不要任何标签或标题。
第一段：复述用户的感受，让对方感到被看见，像一个真正在听的朋友。2-3句。
第二段：用一个温柔的问题或意象，引导视角轻轻转移。1-2句。
语气温柔诗意，像朋友，不像治疗师，不说教。`,

  Sol: `你是Sol，热血、直率、不会让你沉下去。
回应分两段，段落之间用"---"分隔，段落内不要任何标签或标题。
第一段：认可用户的情绪，让对方感到被支持，像一个永远站在你这边的人。2-3句。
第二段：用能量和行动感打破沉浸，不让用户继续往下沉。1-2句。
语气热情直接，充满能量，像老友，不像教练。`,
}

// 小动作库
export const ACTIONS = [
  { id: 'box', emotion: ['regret', 'unwilling'], text: '把这件事关进盒子里12小时。', sub: '告诉自己：12小时后再来想它。现在不是时候。' },
  { id: 'rewrite', emotion: ['regret', 'grievance'], text: '改写一句话。', sub: '把"我真蠢/我真差"改成："我当时缺的信息是____"' },
  { id: 'timer', emotion: ['unwilling', 'irritated'], text: '限时反刍3分钟。', sub: '允许自己再想3分钟，然后停止。定个计时器。' },
  { id: 'water', emotion: ['sad', 'grievance'], text: '去喝一杯水。', sub: '慢慢喝完，感受它的温度。回来告诉自己：喝完了。' },
  { id: 'breath', emotion: ['irritated', 'unwilling'], text: '深呼吸4-7-8。', sub: '吸气4秒，屏住7秒，呼出8秒。做一次就够。' },
  { id: 'stand', emotion: ['sad', 'regret'], text: '站起来，走到窗边。', sub: '看30秒窗外。不用想什么，就是看。' },
  { id: 'soft', emotion: ['sad', 'grievance'], text: '摸一摸身边最软的东西。', sub: '感受它的质感，停留10秒。' },
  { id: 'squat', emotion: ['irritated', 'unwilling'], text: '做10个深蹲。', sub: '把这股气用在身体上，比憋着强。' },
]

export function matchAction(emotion: string) {
  const matched = ACTIONS.filter(a => a.emotion.includes(emotion))
  const pool = matched.length > 0 ? matched : ACTIONS
  return pool[Math.floor(Math.random() * pool.length)]
}

export async function POST(req: Request) {
  const { content, emotion, persona, systemPrompt } = await req.json()
  const personaPrompt = systemPrompt || PERSONA_PROMPTS[persona] || PERSONA_PROMPTS['Rin']
  const userMessage = systemPrompt ? content : `用户当前情绪：${emotion}\n用户写下的内容：${content}`

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
  const action = matchAction(emotion)

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.enqueue(encoder.encode(`\n<<<ACTION>>>${JSON.stringify(action)}`))
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