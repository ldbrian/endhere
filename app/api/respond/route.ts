import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ASH_STATES = ["Ash状态1", "Ash状态2", "Ash状态3"]
const RIN_STATES = ["Rin状态1", "Rin状态2", "Rin状态3"]

export async function POST(req: Request) {
  try {
    const { content, emotion, persona, systemPrompt, clientHour, memoryContext } = await req.json()
    
    // 1. 在使用 isEnglish 之前，必须先声明并赋值
    const isEnglish = req.headers.get('host')?.includes('en.') || 
                      req.headers.get('host')?.includes('nightshift');

    // 2. 世界状态获取
    let activeEvent = 'clear'
    try {
      const { data } = await supabase.from('world_state').select('event_type').eq('id', true).single()
      if (data) activeEvent = data.event_type
    } catch (e) {
      console.error('Failed to fetch world state', e)
    }

    let eventPrompt = ''
    if (activeEvent === 'broken_bulb') eventPrompt = `\n[系统环境：灯泡坏了]`
    else if (activeEvent === 'rain') eventPrompt = `\n[系统环境：正在下雨]`

    const hour = typeof clientHour === 'number' ? clientHour : new Date().getHours()
    const timeContext = `当前小时：${hour}`
    
    const DYNAMIC_PROMPTS: Record<string, string> = {
      Ash: `Ash设定 ${timeContext} ${memoryContext || ''} ${eventPrompt}`,
      Rin: `Rin设定 ${timeContext} ${memoryContext || ''} ${eventPrompt}`,
      Child: `Child设定 ${timeContext} ${memoryContext || ''} ${eventPrompt}`
    }

    // 3. 正确声明 let 变量
    let finalPrompt = systemPrompt || DYNAMIC_PROMPTS[persona] || DYNAMIC_PROMPTS['Rin']

    // 4. 现在可以使用 isEnglish 了
    if (isEnglish) {
      finalPrompt += "\n\n[System Rule]: ALWAYS respond in English. Keep the desolate and cozy tone. Do not explain you are an AI."
    }

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
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) controller.enqueue(encoder.encode(text))
          }
        } catch (streamErr) {
          console.error('[Stream Error]', streamErr)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (fatalError) {
    console.error('[Fatal Error]:', fatalError)
    return new Response('系统信号中断，请稍后再试。', { status: 500 })
  }
}