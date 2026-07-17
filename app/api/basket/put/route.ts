import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { BLOCKED_PATTERNS, createRateLimiter } from '../../../lib/inputGuard';

export const runtime = 'edge';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 第一层：item_shell 白名单，必须是前端预设选项之一
const ALLOWED_SHELLS = [
  '一把伞', '一件外套', '一本书', '一杯饮料',
  '一张纸条', '一副耳机', '一双鞋', '一首歌',
];

// 第二层：本地敏感词快速拦截 —— 模式抽到 lib/inputGuard.ts，本路由透过 BLOCKED_PATTERNS 复用

// IP 频率限制：同一 IP 每小时最多 3 次（沿用原配置）
const ipRateMap = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!ipRateMap.check(ip)) {
      return new Response(JSON.stringify({
        status: 'reject',
        message: '今天留下的东西太多了，明天再来吧。'
      }), { status: 429 });
    }

    const { item_shell, life_slice } = await req.json();

    if (!item_shell || !life_slice) {
      return new Response(JSON.stringify({ error: '内容不能为空' }), { status: 400 });
    }

    if (!ALLOWED_SHELLS.includes(item_shell)) {
      return new Response(JSON.stringify({ error: '不支持的物品类型' }), { status: 400 });
    }

    const trimmed = life_slice.trim();
    if (trimmed.length < 5 || trimmed.length > 100) {
      return new Response(JSON.stringify({
        error: trimmed.length < 5 ? '描述太短了，多写几个字吧' : '最多100个字'
      }), { status: 400 });
    }

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return new Response(JSON.stringify({
          status: 'reject',
          message: '这件东西没办法留在这里。'
        }), { status: 403 });
      }
    }

    const systemPrompt = `你是避难所的守门人。用户想把一样东西留给下一个路过的陌生人。你只需要拦截：恶意谩骂、人身攻击、色情、违法内容、自杀/自伤相关内容。其他所有内容一律放行，不要用审美标准评判质量。返回 {"status": "pass"} 或 {"status": "reject", "reason": "具体原因"}。强制输出JSON格式。`;

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: trimmed }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

    if (aiResponse.status !== 'pass') {
      return new Response(JSON.stringify({
        status: 'reject',
        message: '这件东西没办法留在这里。'
      }), { status: 403 });
    }

    // 🟢 新建物品：初始化 trace_logs，锁定 durability = 5
    const { error } = await supabase.from('iron_basket_items').insert([{
      item_shell,
      trace_logs: [
        { timestamp: new Date().toISOString(), text: trimmed }
      ],
      durability: 5,
    }]);

    if (error) throw error;

    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });

  } catch (error) {
    console.error('[Basket Put Error]', error);
    return new Response(JSON.stringify({ error: 'System Error' }), { status: 500 });
  }
}