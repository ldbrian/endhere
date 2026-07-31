import { createClient } from '@supabase/supabase-js';
import { checkInput, createRateLimiter, getRequestIp } from '../../../lib/inputGuard';

export const runtime = 'nodejs';

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

// 同一 IP 每小时最多 10 条：批注是读者留言，不该被脚本灌爆
const annotationLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 });

export async function POST(req: Request) {
  if (!supabase) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY_MISSING' }, { status: 500 });
  }

  const ip = getRequestIp(req);
  if (!annotationLimiter.check(ip)) {
    return Response.json({ error: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim().slice(0, 128) : '';
  const sourcePath = typeof body?.source_path === 'string' ? body.source_path.trim().slice(0, 256) : '';

  const guard = checkInput(content, { min: 1, max: 2000 });
  if (!guard.ok) {
    return Response.json({ error: guard.reason }, { status: 400 });
  }

  const { error } = await supabase.from('reader_annotations').insert([
    {
      device_id: deviceId || null,
      content,
      source_path: sourcePath || null,
    },
  ]);

  if (error) {
    console.error('[ReaderAnnotation] insert error:', error.message);
    return Response.json({ error: 'STORAGE_FAILED' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
