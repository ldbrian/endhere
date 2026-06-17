import OpenAI from 'openai';

export const runtime = 'edge';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

// ============================================================
// 静默档案员（The Silent Archivist）
// 唯一职责：生成 title 和 narration_content
// 绝对禁止：安慰、说教、分析人格、给建议、心理诊断、输出人生道理
// ============================================================

const SYSTEM_PROMPT = `你是一座人生体验陈列馆的档案员。

你的唯一职责：
1. 为用户写下的体验生成一个简短标题（title），不超过12个字。
2. 生成一句档案旁白（narration_content），不超过40字，用于补充描述这段体验留下的状态或质感。

绝对禁止：
- 安慰用户
- 说教或给建议
- 分析用户的性格或心理状态
- 输出任何人生道理或感悟
- 评判这段体验是好是坏
- 用"你"作为称呼去对用户说话（旁白是客观描述，不是对话）

旁白风格参考：
"它已经不再发声，但仍然保留着某段时间留下的形状。"
"出发时间被折痕压住，目的地也变得不那么重要。"

只输出客观、克制、略带物质感的描述，不输出任何情绪引导。

严格按以下 JSON 格式输出，不要有任何其他文字：
{"title": "...", "narration_content": "..."}`;

export async function POST(req: Request) {
  try {
    const { original_content } = await req.json();

    if (!original_content || typeof original_content !== 'string' || !original_content.trim()) {
      return new Response(JSON.stringify({ error: 'original_content is required' }), { status: 400 });
    }

    const trimmed = original_content.trim().slice(0, 800);

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: trimmed },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    return new Response(JSON.stringify({
      title: String(parsed.title || '').trim(),
      narration_content: String(parsed.narration_content || '').trim(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Archivist Organize Error]', error);
    return new Response(JSON.stringify({ error: 'organize failed' }), { status: 500 });
  }
}