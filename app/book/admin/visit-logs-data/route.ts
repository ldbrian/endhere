import { createClient } from '@supabase/supabase-js';

type VisitLogRow = {
  id: string;
  device_id: string;
  event_name: string;
  is_returning: boolean;
  visit_count: number;
  payload: Record<string, any> | null;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminToken = process.env.FEATURED_ADMIN_TOKEN;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

type AdminAuthResult =
  | { ok: true }
  | { ok: false; response: Response };

function checkAdminToken(request: Request): AdminAuthResult {
  if (!adminToken) {
    return {
      ok: false,
      response: Response.json({ error: 'FEATURED_ADMIN_TOKEN_MISSING' }, { status: 500 }),
    };
  }

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : request.headers.get('x-admin-token')?.trim();

  if (!token || token !== adminToken) {
    return { ok: false, response: Response.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
  }

  return { ok: true };
}

function getDayRange(dateText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;

  const start = new Date(`${dateText}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime())) return null;
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function matchesRoute(row: VisitLogRow, route: string) {
  if (!route) return true;
  const payload = row.payload || {};
  const haystack = [payload.path, payload.url, payload.referrer_path, payload.referrer]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  return haystack.includes(route.toLowerCase());
}

function summarize(rows: VisitLogRow[]) {
  return {
    homeViews: rows.filter((row) => row.event_name.startsWith('v5_')).length,
    leaveFragmentTaps: rows.filter((row) => row.event_name === 'v5_mirror_back_to_book_tap').length,
    fragmentNewViews: rows.filter((row) => row.event_name === 'v5_page_created').length,
    privateFragmentSaves: rows.filter((row) => row.event_name === 'v5_book_page_saved').length,
  };
}

export async function GET(request: Request) {
  const auth = checkAdminToken(request);
  if (!auth.ok) return auth.response;

  if (!supabase) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY_MISSING' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const eventName = (searchParams.get('event') || '').trim();
  const route = (searchParams.get('route') || '').trim();
  const date = (searchParams.get('date') || '').trim();
  const returning = searchParams.get('returning');
  const dayRange = getDayRange(date);

  let requestBuilder = supabase
    .from('visit_logs')
    .select('id, device_id, event_name, is_returning, visit_count, payload, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(500);

  if (eventName) {
    requestBuilder = requestBuilder.ilike('event_name', `%${eventName}%`);
  }

  if (returning === 'new') {
    requestBuilder = requestBuilder.eq('is_returning', false);
  }

  if (returning === 'returning') {
    requestBuilder = requestBuilder.eq('is_returning', true);
  }

  if (dayRange) {
    requestBuilder = requestBuilder.gte('created_at', dayRange.start).lt('created_at', dayRange.end);
  }

  const { data, error, count } = await requestBuilder;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data || []) as VisitLogRow[]).filter((row) => matchesRoute(row, route));

  return Response.json({
    logs: rows.slice(0, 200),
    total: route ? rows.length : count || rows.length,
    summary: summarize(rows),
  });
}
