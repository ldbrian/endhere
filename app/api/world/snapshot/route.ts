// app/api/world/snapshot/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const mutations = await req.json()
    if (!mutations || Object.keys(mutations).length === 0) {
      return NextResponse.json({ success: true })
    }

    // 将 5 分钟内的合并物理动作，作为一次 [世界快照] 打入时序库
    // 后续可以用 SQL 将这些数据进行大盘累加，去影响植物生长或世界事件
    const { error } = await supabase.from('space_telemetry').insert([
      { event_name: 'WORLD_SNAPSHOT', payload: mutations }
    ])

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}