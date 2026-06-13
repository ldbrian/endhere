import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 与 /api/basket/put 共用同一套审核规则
const BLOCKED_PATTERNS = [
  /自杀|自残|去死|想死|死[一了]死|割腕|轻生|跳楼|跳桥|上吊|烧炭/,
  /操你|妈的|fuck|shit|你妈|傻[逼屄]|[滚去]你的|废物.*死/i,
  /做爱|性交|插入|射精|勃起|阴茎|阴道|口交|肛交/,
  /天安门事件|六四|法轮功|台独|藏独|xinjiang.*camp/i,
  /加我微信|扫码|私信|vx:|wx:|qq群|telegram|discord.*邀请/i,
  /1[3-9]\d{9}|(\d{3,4}[-\s]?\d{7,8})/,
];

const ipRateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({
        status: 'reject',
        message: '今天留下的东西太多了，明天再来吧。'
      }), { status: 429 });
    }

    const { item_id, text } = await req.json();

    if (!item_id || !text) {
      return new Response(JSON.stringify({ error: '内容不能为空' }), { status: 400 });
    }

    const trimmed = text.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      return new Response(JSON.stringify({
        error: trimmed.length < 2 ? '写点什么吧' : '最多100个字'
      }), { status: 400 });
    }

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return new Response(JSON.stringify({
          status: 'reject',
          message: '这段话没办法留在这里。'
        }), { status: 403 });
      }
    }

    const systemPrompt = `你是避难所的守门人。用户想在一件物品上追加一段留言，传给下一个路过的陌生人。你只需要拦截：恶意谩骂、人身攻击、色情、违法内容、自杀/自伤相关内容。其他所有内容一律放行，不要用审美标准评判质量。返回 {"status": "pass"} 或 {"status": "reject", "reason": "具体原因"}。强制输出JSON格式。`;

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
        message: '这段话没办法留在这里。'
      }), { status: 403 });
    }

    // 🟢 取出当前物品
    const { data: item, error: fetchError } = await supabase
      .from('iron_basket_items')
      .select('id, item_shell, trace_logs, durability')
      .eq('id', item_id)
      .single();

    if (fetchError || !item) {
      return new Response(JSON.stringify({ error: '这件东西已经不在铁筐里了' }), { status: 404 });
    }

    const newTraceLogs = [
      ...(item.trace_logs || []),
      { timestamp: new Date().toISOString(), text: trimmed }
    ];
    const newDurability = item.durability - 1;

    if (newDurability <= 0) {
      // 🟢 风化：转移至归档废墟库，从铁筐池中永久剔除
      const { error: archiveError } = await supabase.from('basket_archive').insert([{
        item_shell: item.item_shell,
        trace_logs: newTraceLogs,
      }]);
      if (archiveError) throw archiveError;

      const { error: deleteError } = await supabase
        .from('iron_basket_items')
        .delete()
        .eq('id', item_id);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ status: 'weathered' }), { status: 200 });
    }

    // 🟢 正常接力：更新 trace_logs 与 durability
    const { error: updateError } = await supabase
      .from('iron_basket_items')
      .update({ trace_logs: newTraceLogs, durability: newDurability })
      .eq('id', item_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ status: 'success', durability: newDurability }), { status: 200 });

  } catch (error) {
    console.error('[Basket Patch Error]', error);
    return new Response(JSON.stringify({ error: 'System Error' }), { status: 500 });
  }
}