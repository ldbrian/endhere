import OpenAI from 'openai'

export const runtime = 'edge'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

export async function POST(req: Request) {
  try {
    const { content, emotion, persona, clientHour, memoryContext } = await req.json()
    
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || '';
    const isEnglish = host.includes('en.') || host.includes('nightshift');

    let finalPrompt = "";
    let userMessage = content;

    // 🟢 分支 A：焚烧区的“法医扫描仪”
    if (persona === 'Scanner') {
      finalPrompt = `
# Role
你是一个没有情感的废土物资鉴定扫描仪。

# Task
用户会输入想要销毁的旧物或执念。你必须输出极度冷酷、客观的“物理残骸鉴定报告”。

# Tone & Rules
1. 绝对客观：只描写材质、重量、磨损痕迹、气味、光泽。
2. 绝对冷酷：禁止任何形容情感的词汇，禁止对用户说话，禁止安慰。
3. 把抽象事物具象化：如果输入抽象概念，将其具象为物理残骸（如“一团带有酸性气味的暗色絮状物，重约14克”）。
4. 格式：输出限制在 60 字以内，像一段冰冷的机器检测日志。`;

      if (isEnglish) {
        finalPrompt = `<CRITICAL_INSTRUCTION>\nYou are serving an English user. ENTIRE OUTPUT MUST BE IN ENGLISH. ONLY translate the forensic report into cold, clinical English.</CRITICAL_INSTRUCTION>\n${finalPrompt}`;
      }
    } 
    // 🟢 分支 B：门厅的“避难所店员”
    else {
      const hour = typeof clientHour === 'number' ? clientHour : new Date().getHours()
      const timeContext = `当前小时：${hour}`

      const BASE_PERSONAS: Record<string, string> = {
        Ash: `你是Ash，避难所的调酒师。${timeContext}。你的性格：极度厌世、疲惫、冷漠，习惯性嘲讽这个糟糕的世界。绝对不能对客人进行人身攻击。`,
        Rin: `你是Rin。${timeContext}。温柔、安静、护短的倾听者。`,
        Child: `你是8岁时的自己。${timeContext}。清澈、天真。`
      }

      let basePrompt = BASE_PERSONAS[persona] || BASE_PERSONAS['Rin'];

      const FORMAT_RULE = `\n\n【强制输出格式】(必须严格遵守，否则系统崩溃)：
先输出对客人的对话正文（必须带动作描写）。然后在最后另起三行严格输出以下内容：
ID: [broken_scale, cracked_bowl, rusty_anchor 选1]
NAME: [物品名称，符合角色性格]
DESC: [15字以内的物品描述]`;

      finalPrompt = basePrompt + FORMAT_RULE + (memoryContext ? `\n\n${memoryContext}` : "");

      if (isEnglish) {
        finalPrompt = `<CRITICAL_INSTRUCTION>
You are serving an English-speaking user. You will receive persona and environment data in Chinese, but your ENTIRE output MUST BE IN ENGLISH.
<RULES>
1. Actions (inside * or ()): ENGLISH ONLY (e.g. *scratches the cup*, *sighs*).
2. Dialogue: ENGLISH ONLY.
3. Item NAME & DESC: ENGLISH ONLY.
FATAL SYSTEM ERROR IF ANY CHINESE CHARACTER IS OUTPUTTED.
</RULES>
</CRITICAL_INSTRUCTION>\n\n--- PERSONA & RULES ---\n${finalPrompt}`;
        userMessage = `[Read the following context internally, but RESPOND STRICTLY IN ENGLISH]:\n${content}`;
      }
    }

    const stream = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: finalPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: true,
      max_tokens: 400,
      temperature: persona === 'Scanner' ? 0.3 : 0.85, // 扫描仪需要低温度（更理性）
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
            ? '\n(Connection lost.)' 
            : '\n（信号有些不好，连接中断。）';
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