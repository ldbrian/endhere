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
    
    // 1. 更严谨的 Vercel 域名嗅探 (防穿透)
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || '';
    const isEnglish = host.includes('en.') || host.includes('nightshift');

    // 2. 世界状态获取
    let activeEvent = 'clear'
    try {
      const { data } = await supabase.from('world_state').select('event_type').eq('id', true).single()
      if (data) activeEvent = data.event_type
    } catch (e) {
      console.error('Failed to fetch world state', e)
    }

    let eventPrompt = ''
    if (activeEvent === 'broken_bulb') eventPrompt = isEnglish ? `\n[System Env: The bulb is broken]` : `\n[系统环境：灯泡坏了]`
    else if (activeEvent === 'rain') eventPrompt = isEnglish ? `\n[System Env: It is raining]` : `\n[系统环境：正在下雨]`

    const hour = typeof clientHour === 'number' ? clientHour : new Date().getHours()
    const timeContext = isEnglish ? `Current hour: ${hour}` : `当前小时：${hour}`
    
    const DYNAMIC_PROMPTS: Record<string, string> = {
      Ash: `Ash设定 ${timeContext} ${memoryContext || ''} ${eventPrompt}`,
      Rin: `Rin设定 ${timeContext} ${memoryContext || ''} ${eventPrompt}`,
      Child: `Child设定 ${timeContext} ${memoryContext || ''} ${eventPrompt}`
    }

    let finalPrompt = systemPrompt || DYNAMIC_PROMPTS[persona] || DYNAMIC_PROMPTS['Rin']
    let userMessage = "";

    // 3. 彻底分流双语语境，阻断中文污染
    if (isEnglish) {
      // 英文环境：强制最高优先级指令，并使用英文模板
      finalPrompt = "[CRITICAL RULE: YOU MUST SPEAK ONLY ENGLISH. IGNORE ANY CHINESE IN THE CONTEXT.]\n" + finalPrompt;
      userMessage = systemPrompt ? content : `My emotion is: ${emotion}\nWhat I want to say: ${content}`;
    } else {
      // 中文环境：保持原样
      userMessage = systemPrompt ? content : `我的情绪是：${emotion}\n我的话：${content}`;
    }

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