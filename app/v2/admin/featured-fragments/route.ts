import { createClient } from '@supabase/supabase-js';

type FeaturedStatus = 'all' | 'featured' | 'unfeatured';

type FragmentAdminRow = {
  id: string;
  owner_id: string;
  title: string;
  original_content: string;
  narration_content: string | null;
  visibility: 'public' | 'private';
  allow_shopkeeper_review: boolean;
  is_featured: boolean;
  shopkeeper_comment: string | null;
  created_at: string;
  updated_at: string;
  in_active_featured_pool?: boolean;
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

function unauthorized(status = 401) {
  return Response.json({ error: 'UNAUTHORIZED' }, { status });
}

function checkAdminToken(request: Request) {
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
    return { ok: false, response: unauthorized() };
  }

  return { ok: true, response: null };
}

function getStatus(value: string | null): FeaturedStatus {
  if (value === 'featured' || value === 'unfeatured') return value;
  return 'all';
}

function matchesSearch(fragment: FragmentAdminRow, query: string) {
  if (!query) return true;

  const haystack = [
    fragment.title,
    fragment.original_content,
    fragment.narration_content || '',
    fragment.owner_id,
    fragment.shopkeeper_comment || '',
  ]
    .join('\n')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

async function getActiveFeaturedPoolIds() {
  if (!supabase) return new Set<string>();

  const { data, error } = await supabase
    .from('fragments')
    .select('id')
    .eq('visibility', 'public')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return new Set<string>();
  return new Set(data.map((row) => String(row.id)).filter(Boolean));
}

async function getFeaturedCount() {
  if (!supabase) return 0;

  const { count } = await supabase
    .from('fragments')
    .select('id', { count: 'exact', head: true })
    .eq('visibility', 'public')
    .eq('is_featured', true);

  return count || 0;
}

export async function GET(request: Request) {
  const auth = checkAdminToken(request);
  if (!auth.ok) return auth.response;

  if (!supabase) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY_MISSING' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const status = getStatus(searchParams.get('status'));
  const query = (searchParams.get('q') || '').trim();

  let requestBuilder = supabase
    .from('fragments')
    .select(
      'id, owner_id, title, original_content, narration_content, visibility, allow_shopkeeper_review, is_featured, shopkeeper_comment, created_at, updated_at'
    )
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status === 'featured') {
    requestBuilder = requestBuilder.eq('is_featured', true);
  }

  if (status === 'unfeatured') {
    requestBuilder = requestBuilder.eq('is_featured', false);
  }

  const [{ data, error }, activePoolIds, featuredCount] = await Promise.all([
    requestBuilder,
    getActiveFeaturedPoolIds(),
    getFeaturedCount(),
  ]);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const fragments = ((data || []) as FragmentAdminRow[])
    .filter((fragment) => matchesSearch(fragment, query))
    .map((fragment) => ({
      ...fragment,
      in_active_featured_pool: activePoolIds.has(fragment.id),
    }));

  return Response.json({
    fragments,
    featuredCount,
    activePoolSize: activePoolIds.size,
    poolLimit: 50,
  });
}

export async function PATCH(request: Request) {
  const auth = checkAdminToken(request);
  if (!auth.ok) return auth.response;

  if (!supabase) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY_MISSING' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const isFeatured = body?.is_featured;

  if (!id || typeof isFeatured !== 'boolean') {
    return Response.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('fragments')
    .update({ is_featured: isFeatured })
    .eq('id', id)
    .eq('visibility', 'public')
    .select(
      'id, owner_id, title, original_content, narration_content, visibility, allow_shopkeeper_review, is_featured, shopkeeper_comment, created_at, updated_at'
    )
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const [activePoolIds, featuredCount] = await Promise.all([
    getActiveFeaturedPoolIds(),
    getFeaturedCount(),
  ]);

  return Response.json({
    fragment: {
      ...(data as FragmentAdminRow),
      in_active_featured_pool: activePoolIds.has(id),
    },
    featuredCount,
    activePoolSize: activePoolIds.size,
    poolLimit: 50,
  });
}
