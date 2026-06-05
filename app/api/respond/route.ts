import OpenAI from 'openai'

// [CTO 核心注入] 强制开启边缘计算运行时，彻底解除 Vercel 15秒超时斩杀机制
export const runtime = 'edge'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

export async function POST(req: Request) {
  try {
    // 1. 纯粹的数据透传：前端的 ECS 系统已经组装好了完美的 systemPrompt
    const { content, emotion, systemPrompt } = await req.json()
    
    // 2. 更严谨的 Vercel 域名嗅探 (防穿透)
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || '';
    const isEnglish = host.includes('en.') || host.includes('nightshift');

    // 兜底校验：如果前端意外没有传 systemPrompt，给一个极简兜底防止大模型崩溃
    let finalPrompt = systemPrompt || "你是一个安静的便利店店员。"; 
    let userMessage = "";

    // 3. 彻底分流双语语境，使用“封装器”模式阻断中文污染
    if (isEnglish) {
      finalPrompt = `
[CRITICAL SYSTEM OVERRIDE]
You are an AI actor. The following persona instructions and world context are provided in Chinese. 
You must UNDERSTAND the Chinese context, but your ENTIRE OUTPUT MUST BE STRICTLY IN ENGLISH. 
This includes all character actions (e.g., *sighs*, (looks away)), internal monologues, and spoken dialogue.
NEVER output any Chinese characters.

--- PERSONA INSTRUCTIONS (Understand this, do not copy its language) ---
${finalPrompt}
------------------------------------------------------------------------
`;
      userMessage = `My emotion is: ${emotion}\nWhat I want to say: ${content}`;
    } else {
      userMessage = `我的情绪是：${emotion}\n我的话：${content}`;
    }

    // 4. 发起大模型流式请求
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
          console.error('[CTO 拦截] 数据流异常断开', streamErr)
          // 哪怕流断了，也要吐出一个正常的结尾给前端，并适配双语
          const fallbackMsg = isEnglish 
            ? '\n(The connection seems poor. They stopped talking.)' 
            : '\n（信号有些不好，他没有继续说下去）';
          controller.enqueue(encoder.encode(fallbackMsg))
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