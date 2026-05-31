// app/api/telemetry/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 使用 Service Role Key 或者 Anon Key 都可以，只要 Supabase 的 RLS 允许 Insert
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // 确保环境变量配了
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event, ...payload } = body

    if (!event) {
      return NextResponse.json({ error: 'Missing event name' }, { status: 400 })
    }

    // 异步落库，不阻塞响应
    const { error } = await supabase
      .from('space_telemetry')
      .insert([
        { 
          event_name: event, 
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