import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { event_name, properties } = await req.json()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  await supabase.from('events').insert({
    event_name,
    properties,
    ip,
  })

  return Response.json({ ok: true })
}