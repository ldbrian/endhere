import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// 必须使用 Service Role Key 才能绕过 RLS 写入
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { item_shell, life_slice } = await req.json();

    if (!item_shell || !life_slice || life_slice.length > 100) {
      return new Response(JSON.stringify({ error: 'Payload invalid' }), { status: 400 });
    }

    // 🟢 大模型守门人判定
    const systemPrompt = `你是避难所的守门人。用户想把一样东西留给下一个路过的陌生人。你只需要拦截以下内容：恶意谩骂、人身攻击、色情或违法内容。其他所有内容，包括简单的祝福、日常琐事、情绪感受、随意的只言片语，一律放行。不要用你自己的审美标准去评判内容的质量或深度。返回 {"status": "pass"} 或 {"status": "reject", "reason": "具体原因"}。强制输出JSON格式。`;

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: life_slice }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, 
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

    if (aiResponse.status !== 'pass') {
      return new Response(JSON.stringify({ 
        status: 'reject', 
        message: `铁筐拒绝了这件东西：${aiResponse.reason || '内容不适合留在这里'}` 
      }), { status: 403 });
    }

    // 🟢 审核通过，静默落库 (数据库会自动根据默认值设定 available_after 为 24小时后)
    const { error } = await supabase.from('iron_basket_items').insert([{
      item_shell,
      life_slice,
    }]);

    if (error) throw error;

    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });

  } catch (error) {
    console.error('[Basket Put Error]', error);
    return new Response(JSON.stringify({ error: 'System Error' }), { status: 500 });
  }
}