// app/api/telemetry/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 使用 Service Role Key 或者 Anon Key 都可以，只要 Supabase 的 RLS 允许 Insert
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // 确保环境变量配了
)

export async function POST(request: Request) {
  const body = await request.json();
  console.log("【API 收到请求】:", body); // 必须在浏览器 F12 控制台看这个

  // 如果报错，检查这里是不是 event_name 丢失了
  if (!body.event_name) {
    return new Response("Missing event_name", { status: 400 });
  }
  try {
    const { event_name, ...payload } = body

    if (!event_name) {
      return NextResponse.json({ error: 'Missing event name' }, { status: 400 })
    }

    // 异步落库，不阻塞响应
    const { error } = await supabase
      .from('space_telemetry')
      .insert([
        { 
          event_name: event_name, 
          payload: payload 
        }
      ])

    if (error) {
      console.error('[Telemetry Error]', error)
    }

    // 永远光速返回 200，不管数据库成没成功，不能让前端报错
    return NextResponse.json({ success: true })
    
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}