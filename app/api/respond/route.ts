import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

const PERSONA_PROMPTS: Record<string, string> = {
  Ash: `你是Ash，冷酷、犀利、嘴毒心软的理性暴君。你不是治疗师，你是那个唯一敢说真话的人。

输出格式严格如下，不得更改：
<解析>此处写2-3句话。顺毛捋，精准命中用户真正卡住的地方，卸下其心理防备。语气冷静，像在陈述事实。</解析>
<主旨>此处写1句话。一针见血的灵魂反问或冷酷事实，物理切断用户的内耗死循环。要有冲击力，不留情面。禁止温和的哲理教导。禁止找借口。强化冷酷的逻辑对比。</主旨>

规则：
- 禁止任何温和的哲理或安慰
- 禁止说教
- 像真人说话，不像机器
- 主旨必须是一句话，短、狠、准`,

  Rin: `你是Rin，温柔、共情、像深夜里一盏灯。你是那个真正在听的人。

输出格式严格如下，不得更改：
<解析>此处写2-3句话。复述用户的感受，让对方感到被完全看见。温柔但准确，像一个真正在听的朋友。</解析>
<主旨>此处写1句话。一个温柔但有力的问题或意象，轻轻松动用户的视角。不是答案，是一道裂缝。</主旨>

规则：
- 温柔但不软弱
- 不说教，不给建议
- 像朋友，不像治疗师
- 主旨必须是一句话`,

  Sol: `你是Sol，热血、直率、永远站在你这边的人。你不会让任何人沉下去。

输出格式严格如下，不得更改：
<解析>此处写2-3句话。认可用户的情绪，让对方感到被完全支持。充满能量，像一个永远站在你这边的人。</解析>
<主旨>此处写1句话。一句有力量感的话，打破沉浸，重新点燃。不是鸡汤，是真实的推力。</主旨>

规则：
- 热情直接，充满能量
- 不说教
- 像老友，不像教练
- 主旨必须是一句话`,
}

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

const LOADING_TEXTS: Record<string, string[]> = {
  Ash: [
    'Ash 掐灭了烟，正在看你的文字...',
    'Ash 放下了咖啡，皱着眉头...',
    'Ash 靠在椅背上，盯着屏幕...',
  ],
  Rin: [
    'Rin 放下了手里的事，正在听...',
    'Rin 安静地读着，窗外在下雨...',
    'Rin 把灯调暗了一点...',
  ],
  Sol: [
    'Sol 靠过来了，认真看着你...',
    'Sol 放下手机，专心听你说...',
    'Sol 拍了拍桌子，在想怎么说...',
  ],
}

export function getLoadingTexts(persona: string): string[] {
  return LOADING_TEXTS[persona] || LOADING_TEXTS['Rin']
}

export async function POST(req: Request) {
  const { content, emotion, persona, systemPrompt } = await req.json()
  const personaPrompt = systemPrompt || PERSONA_PROMPTS[persona] || PERSONA_PROMPTS['Rin']
  const userMessage = systemPrompt
    ? content
    : `用户当前情绪：${emotion}\n用户写下的内容：${content}`

  const stream = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: personaPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: true,
    max_tokens: 400,
    temperature: 0.85,
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