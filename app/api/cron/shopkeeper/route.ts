import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { createFragmentId } from '../../../v2/_core/fragments';

// 强制 Edge Runtime 以获得更快响应，或保留 Node 侧重稳定性
export const runtime = 'edge';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

// 🟢 店长的三个随机视角
const PERSPECTIVES = [
  "【视角A：遗落的物件】专注描绘城市里被遗弃的物品与流逝的时间。例如：角落里过期的罐头、没有伞把的雨伞、斑马线上的一只手套。不要写人，只写物品的状态。",
  "【视角B：城市的白噪音】专注描绘城市运转的切面与人际边界的冷漠感。例如：便利店冷柜持续的蜂鸣、深夜红绿灯无意义的闪烁、地铁门关闭前的警告音。强调一种抽离感。",
  "【视角C：无意义的荒诞瞬间】专注捕捉生活中毫无意义但极具画面感的瞬间。例如：一个人在路边盯着下水道看、一只停在共享单车座垫上的鸽子。不需要解释为什么，只需要白描。"
];

export async function GET(req: Request) {
  // 为了防止被恶意调用，可以加一个简单的秘钥校验 (Cron Secret)
  // const { searchParams } = new URL(req.url);
  // if (searchParams.get('key') !== process.env.CRON_SECRET) return new Response('Unauthorized', { status: 401 });

  try {
    // 1. 随机抽取一个视角
    const perspective = PERSPECTIVES[Math.floor(Math.random() * PERSPECTIVES.length)];

    const SYSTEM_PROMPT = `你现在是《End Here》人生体验陈列馆的深夜店长。
你是一个沉默的观察者，每天站在玻璃门后看着这个世界。
请根据以下视角，生成一块今天的观察碎片：
${perspective}

要求：
1. original_content (你的观察记录)：不超过 60 个字。极度克制，白描手法，不要带任何感情色彩，不要说教，不要总结人生道理。像是一张用文字拍下的黑白照片。
2. title (标题)：不超过 8 个字，提取核心意象。
3. narration_content (档案旁白)：不需要，直接留空。

严格输出 JSON 格式：
{"title": "...", "original_content": "...", "narration_content": ""}`;

    // 2. 召唤大模型生成碎片
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      response_format: { type: 'json_object' },
      temperature: 0.7, // 稍微高一点的温度，保证创意的随机性
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    if (!parsed.original_content) throw new Error('AI 生成内容为空');

    // 3. 封装为标准 Fragment 并打上公海精选标记
    const now = new Date().toISOString();
    const systemFragment = {
      id: createFragmentId(),
      owner_id: 'system_shopkeeper', // 专属系统账号
      title: parsed.title,
      original_content: parsed.original_content,
      narration_content: '（店长观察日志）',
      visibility: 'public', // 直接进入公海
      allow_shopkeeper_review: false,
      shopkeeper_comment: null,
      meta: {
        source: 'system',
        featured: true, // 核心：打上精选标记，首页才能拉取到
        quality_score: 100
      },
      created_at: now,
      updated_at: now,
    };

    // 4. 强行注入 Supabase 数据库
    const { error } = await supabase.from('fragments').insert([systemFragment]);

    if (error) {
      console.error('[Cron Shopkeeper] 数据库写入失败:', error);
      return NextResponse.json({ error: 'DB Insert Failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '店长已成功留下今天的碎片',
      fragment: systemFragment
    });

  } catch (error) {
    console.error('[Cron Shopkeeper] 执行崩溃:', error);
    return NextResponse.json({ error: 'Cron Execution Failed' }, { status: 500 });
  }
}