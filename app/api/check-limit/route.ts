import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAILY_LIMIT = 5

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const date = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('api_rate_limits')
    .select('count')
    .eq('ip', ip)
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') {
    return Response.json({ allowed: true })
  }

  const count = data?.count || 0

  if (count >= DAILY_LIMIT) {
    return Response.json({ allowed: false, count, limit: DAILY_LIMIT })
  }

  if (!data) {
    await supabase.from('api_rate_limits').insert({ ip, date, count: 1 })
  } else {
    await supabase.from('api_rate_limits').update({ count: count + 1 }).eq('ip', ip).eq('date', date)
  }

  return Response.json({ allowed: true, count: count + 1, limit: DAILY_LIMIT })
}