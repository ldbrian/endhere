// app/api/traces/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// CTO 强制规范：开启 5分钟 (300秒) 边缘缓存屏障
export const revalidate = 300 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET: 5分钟刷新一次全局痕迹
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('physical_traces')
      .select('item_id, last_active_at')
    
    if (error) throw error
    return NextResponse.json({ success: true, traces: data || [] })
  } catch (error) {
    return NextResponse.json({ success: false, traces: [] }, { status: 500 })
  }
}

// PATCH: 接收静默状态更新 (不缓存此路由)
export async function PATCH(req: Request) {
  try {
    const { item_id } = await req.json()
    if (!item_id) return NextResponse.json({ success: false }, { status: 400 })

    // 覆盖更新最后触碰时间
    const { error } = await supabase
      .from('physical_traces')
      .upsert({ item_id, last_active_at: new Date().toISOString() })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}