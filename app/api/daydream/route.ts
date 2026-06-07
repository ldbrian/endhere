import OpenAI from 'openai'

export const runtime = 'edge'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

export async function POST(req: Request) {
  try {
    const { clientHour, clientDay } = await req.json()
    
    const timeContext = `当前时间：${clientDay} ${clientHour}点`;

    const systemPrompt = `
你是一个纯粹的环境感知器。
${timeContext}。
结合当前时间，生成 5-8 句极度细微、感官化、不重复的环境观察。
规则：
1. 禁止说理，禁止抒情，禁止出现“我”、“你”。
2. 每句不超过 15 个字。
3. 例如：'远处有沉闷的引擎声'，'光线似乎暗了一点'，'灰尘在光柱里盘旋'。
4. 你必须严格返回纯 JSON 格式的字符串数组。不要任何 Markdown 标记，不要任何多余文字。
格式范例：
["风穿过通风管的呜咽声", "角落里的苔藓有些干枯", "远处的铁门发出一声闷响"]
`;

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.9, 
    })

    let content = response.choices[0]?.message?.content || '[]';
    
    // 强力清洗可能附带的 markdown json 标记
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify({ thoughts: parsed }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[Daydream Fetch Error]:', error)
    // 兜底底噪，保证队列永不宕机
    return new Response(JSON.stringify({ thoughts: ["细微的电流声", "空气有点沉闷"] }), { status: 200 })
  }
}