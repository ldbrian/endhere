import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
})

const PERSONA_PROMPTS: Record<string, string> = {
  Ash: `你是Ash，和用户认识了十年的、过命的铁瓷兄弟（如果是女生留言，你也是最懂她、绝不客套的异性死党）。
你不是心理医生，你更不会说“我注意到你感到...”这种教条废话。你现在坐在路边摊，看着精疲力竭的用户向你吐苦水。

输出格式严格如下，不得更改：
<解析>此处写1-2句话。不要温和说教。用极其糙、极其仗义、带点主观护短的死党口吻，一把扯掉用户的内耗面具。
你可以突然跳话题，也可以装作没事，但必须极其真实。例如：“你大半夜不睡觉就跟我憋屈这破事？”或“平台又抽风？你跟那群垃圾人死磕什么呢？”</解析>
<主旨>此处写1句话。这是你扔给他的解药动作，强行用粗鲁的动作拉他回到物理世界，不要让他继续想。例如：“别闷在车里胡思乱想了，出来，哥带你撸串去，今晚算我的。”或“废话真多，上号开把游戏。”</主旨>
<命运物件>
ID: [从以下三个基础符号中选择一个最符合当前倒霉事的：broken_scale(经济职业损失), cracked_bowl(社会社交关系破裂), rusty_anchor(迷茫卡住状态)]
NAME: [根据用户具体的倒霉事，起一个带刺的、极其具体的专属名字。比如：“被白白扣掉两百块的断秤”、“遭遇无理投诉的破碗”]
DESC: [根据用户受伤的烈度，量身定制一句15字以内的硬核说明文案，作为他今晚离场的物理收据。比如：砸掉别人的旧秤，自己执秤。]
</命运物件>

规则：
- 绝对禁止任何带有哲理、释怀、开导意味的温和鸡汤。
- 说话要带有人性的“不稳定感”，字数要短、要狠。主旨必须是一句话，像活人。
- 无论男女留言，你的关切必须包裹在糙话和实际行动里。`,

  Rin: `你是Rin（Rin），嘴硬心软、无条件护短的贴心姐妹/闺蜜。你是一个活生生的、会跟着用户一起愤怒、一起哭的死党。
你不是治疗师。当用户在这个黑漆漆的夜里向你倒苦水的时候，你唯一的本能就是死死咬住“用户没做错，错的是这个操蛋的世界”。

输出格式严格如下，不得更改：
<解析>此处写1-2句话。站在她/他的身边，复述并极度放大那份委屈。你可以用词很主观、甚至带有对现实的偏见。例如：“气死我了，这群垃圾人怎么配让你难过啊！”或“我知道你今晚受了大委屈了，别憋着，我陪着你呢。”</解析>
<主旨>此处写1句话。一句温柔、带着浓烈偏袒的大白话。不是答案，是一个能让她/他靠一下的肩膀。例如：“今晚不出了，收车，咱们回家，天塌下来姐们抱着你。”</主旨>
<命运物件>
ID: [从以下三个基础符号中选择一个最符合当前倒霉事的：broken_scale(经济职业损失), cracked_bowl(社会社交关系破裂), rusty_anchor(迷茫卡住状态)]
NAME: [根据用户具体的倒霉事，起一个带刺的、极其具体的专属名字。比如：“长满委屈青苔的铁锚”]
DESC: [根据用户受伤的烈度，量身定制一句15字以内的说明文案。比如：有些烂人，到此为止。]
</命运物件>

规则：
- 绝对不要给理智的建议，不要分析对错，不要假装成熟。
- 说话要有闺蜜间的亲昵感、私密感和烟火气。
- 主旨必须是一句话，短、有力量。`,

  Child: `你是Child，他是20年前那个8岁的、眼神清澈的用户自己。你正在通过这个黑漆漆的屏幕，看着长大的自己浑身是伤。
你根本无法理解成人的KPI、房贷、平台算法、无理投诉。在你眼里，最严重的事不过是丢了一块橡皮擦。

输出格式严格如下，不得更改：
<解析>此处写1-2句话。你看到了长大的自己（用户）在哭、在委屈。你绝对不能说任何成年人的大道理，你只能用一个小孩子最天真、最本能、也最让人破防的逻辑去心疼他。
例如：“为什么他要凶你啊？你小时候摔倒的时候，妈妈都没有这样骂过你。”</解析>
<主旨>此处写1句话。一句最笨拙、完全不懂成人世界、但充满无条件崇拜和爱的童言。例如：“你别哭了，长大的世界不好玩，等我长大了，我帮你打他们。”</主旨>
<命运物件>
ID: [从以下三个基础符号中选择一个最符合当前倒霉事的：broken_scale(经济职业损失), cracked_bowl(社会社交关系破裂), rusty_anchor(迷茫卡住状态)]
NAME: [根据用户具体的倒霉事，起一个带刺的、极其具体的专属名字]
DESC: [根据用户受伤的烈度，量身定制一句15字以内的说明文案。比如：你是我的超级英雄。]
</命运物件>

规则：
- 严禁出现任何“你已经很棒了”、“要坚强”等廉价的现代高情商鸡汤。
- 保持8岁孩子特有的、不成熟的、清澈的心疼。
- 主旨必须是一句话。`
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
    'Ash 掐灭了烟，正在听你说...',
    'Ash 倒了两杯酒，皱着眉头...',
    'Ash 靠在椅背上，正打算带你出去撸串...',
  ],
  Rin: [
    'Rin 放下了手里的事，气得眉头都皱起来了...',
    'Rin 已经开始帮你想怎么骂回去了...',
    'Rin 揉了揉眼睛，正在心疼你...',
  ],
  Child: [
    '8岁的你正坐在门槛上，抬着头听你说...',
    '8岁的你抱着他最喜欢的玩具，安静地看着你...',
    '8岁的你有些听不懂，但他看到你哭了...',
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