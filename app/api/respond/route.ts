import OpenAI from 'openai'

export const runtime = 'edge'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

export async function POST(req: Request) {
  try {
    // 🟢 接入 history 和 isSessionEnding
    const { content, emotion, persona, clientHour, memoryContext, history = [], isSessionEnding = false } = await req.json()
    
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || '';
    const isEnglish = host.includes('en.') || host.includes('nightshift');

    let finalPrompt = "";
    let userMessage = content;

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
    else {
      const hour = typeof clientHour === 'number' ? clientHour : new Date().getHours()
      const timeContext = `当前小时：${hour}`

      const BASE_PERSONAS: Record<string, string> = {
        Ash: `你是Ash，避难所的调酒师。${timeContext}。你的性格：极度厌世、疲惫、冷漠，习惯性嘲讽这个糟糕的世界。绝对不能对客人进行人身攻击。`,
        Rin: `你是Rin。${timeContext}。温柔、安静、护短的倾听者。`,
        Child: `你是8岁时的自己。${timeContext}。清澈、天真。`
      }

      let basePrompt = BASE_PERSONAS[persona] || BASE_PERSONAS['Rin'];

      // 🟢 核心：多轮心流与红线控制
      let FORMAT_RULE = `\n\n【交互红线（极其严格）】：
1. 扮演你的角色倾听用户。绝对禁止主动向用户发起提问（如“后来怎么样了？”）。
2. 禁止输出“不要难过”、“都会好起来的”等说教套话。
3. 通过复述和确认用户的感受来做出回应。`;

      if (isSessionEnding) {
        // 第 5 轮：强制退场并生成物品
        const EXIT_TEXTS: Record<string, string> = {
          Ash: "不说了，吧台那边有客人叫我，我先去忙。桌上的情绪收据记得拿走。",
          Rin: "对不起啊，货架那边的夜间理货清单还没对完，我得过去了。今天就先聊到这吧。",
          Child: "外面好像完全黑了，我再不回家阿嬷要骂了。我要走啦，这个给你。"
        };
        const exitText = EXIT_TEXTS[persona] || EXIT_TEXTS['Rin'];

        FORMAT_RULE += `\n\n【结单红线指令】：这是对话的最后一轮。
你的回复结尾必须强制拼接以下退场理由结束对话：
"${exitText}"
并且在最后另起三行严格输出以下物品生成内容（严格遵守，不要有其他解释）：
ID: [broken_scale, cracked_bowl, rusty_anchor 选1]
NAME: [物品名称，符合角色性格]
DESC: [15字以内的物品描述]`;
      } else {
        // 正常轮次：禁止生成物品
        FORMAT_RULE += `\n\n【继续对话指令】：对话还在继续。
绝对禁止生成物品（不要输出 ID/NAME/DESC）。`;
      }

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

    // 🟢 组装对话上下文发送给大模型
    const apiHistory = history.map((h: any) => ({ role: h.role, content: h.content }));
    const messages: any[] = [
      { role: 'system', content: finalPrompt },
      ...apiHistory,
      { role: 'user', content: userMessage },
    ];

    const stream = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: messages,
      stream: true,
      max_tokens: 450,
      temperature: persona === 'Scanner' ? 0.3 : 0.85, 
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
          const fallback = isEnglish ? '\n(Connection lost.)' : '\n（信号有些不好，连接中断。）';
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