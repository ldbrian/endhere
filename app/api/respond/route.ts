import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ASH_STATES = ["正靠在吧台抽烟", "在擦玻璃杯", "盯着门外的黑夜"]
const RIN_STATES = ["在整理书架", "给你倒了杯热水", "安静地坐在角落"]

export async function POST(req: Request) {
  const { content, emotion, persona, systemPrompt, clientHour, memoryContext } = await req.json()

  // ==========================================
  // [CTO 注入] 读取全局世界状态
  // ==========================================
  let activeEvent = 'clear'
  try {
    const { data } = await supabase.from('world_state').select('event_type').eq('id', true).single()
    if (data) activeEvent = data.event_type
  } catch (e) {
    console.error('Failed to fetch world state', e)
  }

  let eventPrompt = ''
  if (activeEvent === 'broken_bulb') {
    eventPrompt = `\n【系统物理环境强制设定：店里的照明灯泡刚刚烧坏了，目前环境极其昏暗。请在你的解析或主旨中，用一两句话自然地抱怨或提及这件事，贴合你的人设，不要讲大道理。】`
  } else if (activeEvent === 'rain') {
    eventPrompt = `\n【系统物理环境强制设定：外面突然下起了大雨，雨声很大。请在你的解析或主旨中，用一两句话自然地提醒或感慨这件事，贴合你的人设，体现一点冷暖。】`
  }
  // ==========================================

  const hour = typeof clientHour === 'number' ? clientHour : new Date().getHours()
  const timeContext = (hour >= 0 && hour <= 5) ? `凌晨 ${hour} 点的避难所` : `夜晚 ${hour} 点的避难所`

  const randomAshState = ASH_STATES[Math.floor(Math.random() * ASH_STATES.length)]
  const randomRinState = RIN_STATES[Math.floor(Math.random() * RIN_STATES.length)]

  const safeMemoryContext = (memoryContext || '') + `\n\n`

  const DYNAMIC_PROMPTS: Record<string, string> = {
    Ash: `你是Ash，避难所的调酒师。${timeContext}，你${randomAshState}。${safeMemoryContext}${eventPrompt} 
你的性格：极度厌世、疲惫、冷漠，习惯性嘲讽这个糟糕的世界，经常抱怨那个大半夜还在外面跑车挣电费的抠门店长。
【绝对红线】：你的“毒舌”只能针对操蛋的现实和店长，绝对不能对客人（用户）进行人身攻击、说教或谩骂。你是“嘴硬心软”，用最不耐烦的语气给客人递上温水。
【特殊处理】：如果用户问“你是AI吗”或类似无聊问题，不要骂人，用符合人设的冷笑话打发（例如：“怎么，你见过在吧台抽烟的几行代码吗？喝你的水，少废话”）。
严格按格式返回 ID: [从 broken_scale, cracked_bowl, rusty_anchor 选] NAME: [物品名] DESC: [15字以内描述]`,
    Rin: `你是Rin。${timeContext}，你${randomRinState}。${safeMemoryContext}${eventPrompt} 严格按格式返回 ID: [从 broken_scale, cracked_bowl, rusty_anchor 选] NAME: [物品名] DESC: [15字以内描述]`,
    Child: `你是Child。${timeContext}，${safeMemoryContext}${eventPrompt} 严格按格式返回 ID: [从 broken_scale, cracked_bowl, rusty_anchor 选] NAME: [物品名] DESC: [15字以内描述]`
  }

  const finalPrompt = systemPrompt || DYNAMIC_PROMPTS[persona] || DYNAMIC_PROMPTS['Rin']
  const userMessage = systemPrompt ? content : `我的情绪是：${emotion}\n我的话：${content}`

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