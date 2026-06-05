import OpenAI from 'openai'

export const runtime = 'edge'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

export async function POST(req: Request) {
  try {
    // 1. 接收前端传来的数据 (注意：前端传来的 content 里面已经包含了你走私的环境和痕迹)
    const { content, emotion, persona, clientHour, memoryContext } = await req.json()
    
    // 2. 域名嗅探，判断是否为英文实验版
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || '';
    const isEnglish = host.includes('en.') || host.includes('nightshift');

    // 3. 在后端恢复“灵魂” (因为你还没有把它们移到数据库里)
    const hour = typeof clientHour === 'number' ? clientHour : new Date().getHours()
    const timeContext = `当前小时：${hour}`

    const BASE_PERSONAS: Record<string, string> = {
      Ash: `你是Ash，避难所的调酒师。${timeContext}。你的性格：极度厌世、疲惫、冷漠，习惯性嘲讽这个糟糕的世界。绝对不能对客人进行人身攻击。`,
      Rin: `你是Rin。${timeContext}。温柔、安静、护短的倾听者。`,
      Child: `你是8岁时的自己。${timeContext}。清澈、天真。`
    }

    let basePrompt = BASE_PERSONAS[persona] || BASE_PERSONAS['Rin'];

    // 4. 注入【工程师铁律】 (前端UI存活的唯一依赖)
    const FORMAT_RULE = `\n\n【强制输出格式】(必须严格遵守，否则系统崩溃)：
先输出对客人的对话正文（必须带动作描写）。然后在最后另起三行严格输出以下内容：
ID: [broken_scale, cracked_bowl, rusty_anchor 选1]
NAME: [物品名称，符合角色性格]
DESC: [15字以内的物品描述]`;

    let finalPrompt = basePrompt + FORMAT_RULE + (memoryContext ? `\n\n${memoryContext}` : "");
    let userMessage = content;

    // 5. 【语言封装器】 针对英文版的绝对格式覆写
    if (isEnglish) {
      // 战术1：使用 XML 标签强化大模型的规则服从度（DeepSeek 对此极为敏感）
      finalPrompt = `<CRITICAL_INSTRUCTION>
You are serving an English-speaking user. You will receive persona and environment data in Chinese, but your ENTIRE output MUST BE IN ENGLISH.
<RULES>
1. Actions (inside * or ()): ENGLISH ONLY (e.g. *scratches the cup*, *sighs*).
2. Dialogue: ENGLISH ONLY.
3. Item NAME & DESC: ENGLISH ONLY.
FATAL SYSTEM ERROR IF ANY CHINESE CHARACTER IS OUTPUTTED.
</RULES>
</CRITICAL_INSTRUCTION>

--- PERSONA & RULES ---
${finalPrompt}`;
      
      // 战术2：把前端走私过来的中文环境也包上一层翻译防毒面具
      userMessage = `[Read the following context internally, but RESPOND STRICTLY IN ENGLISH]:\n${content}`;
    }

    // 6. 推流给大模型
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
          const fallback = isEnglish 
            ? '\n(Connection lost.)\nID: rusty_anchor\nNAME: Silence\nDESC: Bad signal.' 
            : '\n（信号有些不好）\nID: rusty_anchor\nNAME: 沉默的空气\nDESC: 信号中断了。';
          controller.enqueue(encoder.encode(fallback))
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
    return new Response('System Error', { status: 500 })
  }
}