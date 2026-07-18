import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

export async function POST(request: Request) {
  if (!supabase) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY_MISSING' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const eventName = typeof body?.event_name === 'string' ? body.event_name.trim() : '';
  const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : '';
  const isReturning = Boolean(body?.is_returning);
  const visitCount = Number.isFinite(body?.visit_count) ? Number(body.visit_count) : 0;
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};

  if (!eventName || !deviceId) {
    return Response.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const { error } = await supabase.from('visit_logs').insert([
    {
      device_id: deviceId,
      event_name: eventName,
      is_returning: isReturning,
      visit_count: visitCount,
      payload,
    },
  ]);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
