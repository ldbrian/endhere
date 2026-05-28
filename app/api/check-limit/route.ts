import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAILY_LIMIT = 3

export async function POST(req: Request) {
  // 优化 IP 获取逻辑，兼容 Vercel 和本地环境
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'local_dev_ip'
  const date = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('api_rate_limits')
    .select('count')
    .eq('ip', ip)
    .eq('date', date)
    .single()

  // 加上报错打印，防止静默失败
  if (error && error.code !== 'PGRST116') {
    console.error('⚠️ Supabase 限流查询报错:', error)
    return Response.json({ allowed: true }) // 兜底策略：报错则放行
  }

  const count = data?.count || 0

  if (count >= DAILY_LIMIT) {
    return Response.json({ allowed: false, count, limit: DAILY_LIMIT })
  }

  if (!data) {
    const { error: insertError } = await supabase.from('api_rate_limits').insert({ ip, date, count: 1 })
    if (insertError) {
      console.error('❌ Supabase 写入新 IP 失败:', insertError)
    } else {
      console.log('✅ 成功写入新访客记录:', ip)
    }
  } else {
    const { error: updateError } = await supabase.from('api_rate_limits').update({ count: count + 1 }).eq('ip', ip).eq('date', date)
    if (updateError) {
      console.error('❌ Supabase 更新次数失败:', updateError)
    } else {
      console.log(`🔄 访客 ${ip} 次数已更新为:`, count + 1)
    }
  }

  return Response.json({ allowed: true, count: count + 1, limit: DAILY_LIMIT })
}