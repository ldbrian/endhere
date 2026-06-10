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

// 第一层：item_shell 白名单，必须是前端预设选项之一
const ALLOWED_SHELLS = [
  '一把伞', '一件外套', '一本书', '一杯饮料',
  '一张纸条', '一副耳机', '一双鞋', '一首歌',
];

// 第二层：本地敏感词快速拦截，命中直接 403 不走 AI
const BLOCKED_PATTERNS = [
  // 自杀/自伤
  /自杀|自残|去死|想死|死[一了]死|割腕|轻生|跳楼|跳桥|上吊|烧炭/,
  // 严重谩骂
  /操你|妈的|fuck|shit|你妈|傻[逼屄]|[滚去]你的|废物.*死/i,
  // 色情
  /做爱|性交|插入|射精|勃起|阴茎|阴道|口交|肛交/,
  // 政治敏感（基础）
  /天安门事件|六四|法轮功|台独|藏独|xinjiang.*camp/i,
  // 广告/引流
  /加我微信|扫码|私信|vx:|wx:|qq群|telegram|discord.*邀请/i,
  // 联系方式
  /1[3-9]\d{9}|(\d{3,4}[-\s]?\d{7,8})/,
];

// IP 频率限制：同一 IP 每小时最多 3 次（存 Supabase KV 或内存，edge 用简单方案）
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

    // 频率限制
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ 
        status: 'reject', 
        message: '今天留下的东西太多了，明天再来吧。' 
      }), { status: 429 });
    }

    const { item_shell, life_slice } = await req.json();

    // 基础字段校验
    if (!item_shell || !life_slice) {
      return new Response(JSON.stringify({ error: '内容不能为空' }), { status: 400 });
    }

    // item_shell 白名单校验
    if (!ALLOWED_SHELLS.includes(item_shell)) {
      return new Response(JSON.stringify({ error: '不支持的物品类型' }), { status: 400 });
    }

    // life_slice 长度校验（最短5字，最长100字）
    const trimmed = life_slice.trim();
    if (trimmed.length < 5 || trimmed.length > 100) {
      return new Response(JSON.stringify({ 
        error: trimmed.length < 5 ? '描述太短了，多写几个字吧' : '最多100个字' 
      }), { status: 400 });
    }

    // 本地敏感词拦截（快速，不走 AI）
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return new Response(JSON.stringify({ 
          status: 'reject', 
          message: '这件东西没办法留在这里。' 
        }), { status: 403 });
      }
    }

    // AI 守门人（兜底，处理本地规则覆盖不到的情况）
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

    // 落库
    const { error } = await supabase.from('iron_basket_items').insert([{
      item_shell,
      life_slice: trimmed,
    }]);

    if (error) throw error;

    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });

  } catch (error) {
    console.error('[Basket Put Error]', error);
    return new Response(JSON.stringify({ error: 'System Error' }), { status: 500 });
  }
}