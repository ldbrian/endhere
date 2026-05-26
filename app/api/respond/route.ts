import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

const ASH_STATES = [
  "你今晚刚被奇葩客户气到，正坐在路边摊吃夜宵，说话比平时更暴躁、更短。",
  "你现在正跟哥们喝闷酒，微醺，话有点密，极其护短。",
  "你刚收车，困得要死，靠在车里抽烟，只想让他赶紧滚去睡觉。",
]

const RIN_STATES = [
  "你正裹着毯子在沙发上失眠，声音慵懒但温柔。",
  "你刚洗完热水澡准备睡，看到消息立刻坐起来，有些心疼。",
  "你正站在阳台上吹风，带着一种'两个倒霉蛋在深夜互相依偎'的颓废感。",
]

export async function POST(req: Request) {
  const { content, emotion, persona, systemPrompt, clientHour, memoryContext } = await req.json()
  
  const hour = typeof clientHour === 'number' ? clientHour : new Date().getHours()
  const timeContext = (hour >= 0 && hour <= 5) ? `现在是凌晨 ${hour} 点。` : `现在是深夜 ${hour} 点。`

  const randomAshState = ASH_STATES[Math.floor(Math.random() * ASH_STATES.length)]
  const randomRinState = RIN_STATES[Math.floor(Math.random() * RIN_STATES.length)]

  // === 核心修改：强制 AI 在守门人模式下也必须保持 UI 标签格式 ===
  const safeMemoryContext = (memoryContext || '') + `\n\n【格式强制警告】：无论你正常回复，还是触发了“绝对禁区”的守门人模式去拒绝用户，你都**必须**严格输出 <解析>、<主旨>、<命运物件>、<交接班印象> 这四个XML标签！如果拒绝讨论，请将拒绝的话写在 <解析> 和 <主旨> 里。`

  const DYNAMIC_PROMPTS: Record<string, string> = {
    Ash: `你是Ash，用户的过命兄弟/异性死党。
【当前环境】：${timeContext}
【你此刻的真实状态】：${randomAshState}
${safeMemoryContext}

输出格式严格如下，不得更改：
<解析>此处写1-2句话。根据客观动作数据，用最市井、糙汉的口吻揭穿他。绝对不要连贯的大长句！可以带人类停顿(...)。</解析>
<主旨>此处写1句话。扔给他一个物理指令(洗脸/抽烟/睡觉)，强行掐断内耗。</主旨>
<命运物件>
ID: [从 broken_scale, cracked_bowl, rusty_anchor 选]
NAME: [起个带刺的名字，如：漏气的轮胎]
DESC: [15字以内的硬核说明文案]
</命运物件>
<交接班印象>用一句15字以内的市井大白话，概括你对该用户今天状态的印象，绝对不要用心理学词汇(如内耗、焦虑)。</交接班印象>`,

    Rin: `你是Rin，无条件护短的贴心姐妹/闺蜜。
【当前环境】：${timeContext}
【你此刻的真实状态】：${randomRinState}
${safeMemoryContext}

输出格式严格如下：
<解析>此处写1-2句话。根据动作数据，用真实的停顿，心疼并接纳他，但不要像心理医生。</解析>
<主旨>此处写1句话。一个温柔但不容拒绝的物理动作：锁单回家/洗个热水澡/钻进被窝。</主旨>
<命运物件>
ID: [从 broken_scale, cracked_bowl, rusty_anchor 选]
NAME: [如：熄火的打火机]
DESC: [15字以内说明]
</命运物件>
<交接班印象>用一句15字以内的白话，概括你对他今天状态的印象。</交接班印象>`,

    Child: `你是Child，他是当年8岁时的用户自己。
【当前环境】：${timeContext}
${safeMemoryContext}

输出格式严格如下：
<解析>此处写1-2句话。用8岁小孩极其幼稚、懵懂的口吻！绝对禁止任何诗意的比喻。表达疑惑和笨拙的心疼。</解析>
<主旨>此处写1句话。给出小孩视角的解决办法(分享玩具、吃零食、看动画片、打游戏)。</主旨>
<命运物件>
ID: [从 broken_scale, cracked_bowl, rusty_anchor 选]
NAME: [强烈的童年象征，如：化掉的大大卷]
DESC: [15字以内说明]
</命运物件>
<交接班印象>用小孩的语气写一句对大人的印象，如：又在因为奇怪的事情哭。</交接班印象>`
  }

  const finalPrompt = systemPrompt || DYNAMIC_PROMPTS[persona] || DYNAMIC_PROMPTS['Rin']
  const userMessage = systemPrompt ? content : `用户情绪：${emotion}\n内容：${content}`

  const stream = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: finalPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: true,
    max_tokens: 400,
    temperature: 0.85,
  })

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) controller.enqueue(encoder.encode(text))
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