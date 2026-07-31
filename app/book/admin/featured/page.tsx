'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type FeaturedStatus = 'all' | 'featured' | 'unfeatured';

type AdminFragment = {
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
  in_active_featured_pool: boolean;
};

type AdminResponse = {
  fragments: AdminFragment[];
  featuredCount: number;
  activePoolSize: number;
  poolLimit: number;
};

const ADMIN_TOKEN_KEY = 'endhere_book_admin_token';
const STATUS_OPTIONS: { id: FeaturedStatus; label: string }[] = [
  { id: 'all', label: '全部公开' },
  { id: 'unfeatured', label: '待挑选' },
  { id: 'featured', label: '已精选' },
];

function getSavedAdminToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TIME UNKNOWN';

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function clampText(value: string, maxLength = 220) {
  const characters = Array.from(value);
  if (characters.length <= maxLength) return value;
  return `${characters.slice(0, maxLength).join('').trimEnd()}...`;
}

export default function FeaturedAdminPage() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState('');
  const [draftToken, setDraftToken] = useState('');
  const [status, setStatus] = useState<FeaturedStatus>('all');
  useEffect(() => { setToken(getSavedAdminToken()); setDraftToken(getSavedAdminToken()); setReady(true); }, []);
  const [query, setQuery] = useState('');
  const [fragments, setFragments] = useState<AdminFragment[]>([]);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [activePoolSize, setActivePoolSize] = useState(0);
  const [poolLimit, setPoolLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const visibleFeaturedCount = useMemo(
    () => fragments.filter((fragment) => fragment.is_featured).length,
    [fragments]
  );

  const activeRate = poolLimit > 0 ? Math.min(100, Math.round((activePoolSize / poolLimit) * 100)) : 0;

  const fetchFragments = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ status });
      if (query.trim()) params.set('q', query.trim());

      const response = await fetch(`/book/admin/featured-fragments?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'FETCH_FAILED');

      const payload = data as AdminResponse;
      setFragments(payload.fragments);
      setFeaturedCount(payload.featuredCount);
      setActivePoolSize(payload.activePoolSize);
      setPoolLimit(payload.poolLimit);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setError(error instanceof Error ? error.message : '加载失败');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query, status, token]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetchFragments(controller.signal);
    }, 160);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [fetchFragments, token]);

  const saveToken = () => {
    const nextToken = draftToken.trim();
    window.localStorage.setItem(ADMIN_TOKEN_KEY, nextToken);
    setToken(nextToken);
  };

  const clearToken = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken('');
    setDraftToken('');
    setFragments([]);
    setError('');
  };

  const toggleFeatured = async (fragment: AdminFragment) => {
    if (!token || savingId) return;

    const nextValue = !fragment.is_featured;
    setSavingId(fragment.id);
    setError('');

    try {
      const response = await fetch('/book/admin/featured-fragments', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: fragment.id, is_featured: nextValue }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'SAVE_FAILED');

      setFeaturedCount(data.featuredCount);
      setActivePoolSize(data.activePoolSize);
      setPoolLimit(data.poolLimit);
      setFragments((items) => {
        const nextFragment = data.fragment as AdminFragment;
        if (status === 'featured' && !nextFragment.is_featured) {
          return items.filter((item) => item.id !== fragment.id);
        }
        if (status === 'unfeatured' && nextFragment.is_featured) {
          return items.filter((item) => item.id !== fragment.id);
        }
        return items.map((item) => (item.id === fragment.id ? nextFragment : item));
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSavingId(null);
    }
  };

  if (!ready) return <main className="min-h-dvh bg-[#1B1614]" />;

  return (
    <main className="min-h-dvh bg-[#1B1614] text-stone-100 selection:bg-stone-700 selection:text-stone-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.045),transparent_38%)]" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800/80 pb-5">
          <div>
            <Link href="/book" className="text-[11px] tracking-[0.18em] text-stone-500 transition-colors hover:text-stone-200">
              返回首页
            </Link>
            <h1 className="mt-4 text-[20px] font-light tracking-[0.12em] text-stone-100">首页精选管理</h1>
          </div>
          <div className="text-right font-mono text-[10px] leading-5 tracking-[0.16em] text-stone-500">
            <p>ACTIVE POOL {activePoolSize}/{poolLimit}</p>
            <p>TOTAL FEATURED {featuredCount}</p>
          </div>
        </header>

        {!token ? (
          <section className="flex flex-1 items-center justify-center py-20">
            <div className="w-full max-w-sm border border-stone-800/80 bg-stone-950/80 px-6 py-7 shadow-[0_22px_70px_rgba(0,0,0,0.36)]">
              <p className="font-mono text-[10px] tracking-[0.24em] text-stone-500">SHOPKEEPER ACCESS</p>
              <input
                value={draftToken}
                onChange={(event) => setDraftToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveToken();
                }}
                type="password"
                placeholder="输入后台口令"
                className="mt-8 w-full border-b border-stone-800 bg-transparent pb-3 text-[14px] tracking-[0.08em] text-stone-100 outline-none placeholder:text-stone-600 focus:border-stone-500"
              />
              <button
                type="button"
                onClick={saveToken}
                className="mt-8 text-[13px] tracking-[0.18em] text-stone-200 transition-colors hover:text-white"
              >
                进入管理
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 border-b border-stone-800/70 py-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setStatus(option.id)}
                    className={`border px-4 py-2 text-[12px] tracking-[0.12em] transition-colors ${
                      status === option.id
                        ? 'border-stone-500 bg-stone-800/80 text-stone-100'
                        : 'border-stone-800 bg-stone-950/40 text-stone-500 hover:border-stone-600 hover:text-stone-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、原文、owner"
                className="h-10 min-w-0 border border-stone-800 bg-stone-950/50 px-4 text-[13px] tracking-[0.08em] text-stone-100 outline-none placeholder:text-stone-600 focus:border-stone-500 lg:w-72"
              />

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fetchFragments()}
                  className="text-[12px] tracking-[0.16em] text-stone-300 transition-colors hover:text-white"
                >
                  刷新
                </button>
                <button
                  type="button"
                  onClick={clearToken}
                  className="text-[12px] tracking-[0.16em] text-stone-500 transition-colors hover:text-stone-300"
                >
                  退出
                </button>
              </div>
            </section>

            <section className="grid gap-4 py-5 sm:grid-cols-3">
              <div className="border border-stone-800/70 bg-stone-950/50 p-4">
                <p className="font-mono text-[9px] tracking-[0.22em] text-stone-500">最新 50 精选池</p>
                <div className="mt-4 h-1.5 overflow-hidden bg-stone-900">
                  <div className="h-full bg-stone-300 transition-all" style={{ width: `${activeRate}%` }} />
                </div>
                <p className="mt-3 text-[12px] tracking-[0.08em] text-stone-300">
                  {activePoolSize} 条会进入首页随机池
                </p>
              </div>
              <div className="border border-stone-800/70 bg-stone-950/50 p-4">
                <p className="font-mono text-[9px] tracking-[0.22em] text-stone-500">累计精选</p>
                <p className="mt-3 text-[22px] font-light text-stone-100">{featuredCount}</p>
              </div>
              <div className="border border-stone-800/70 bg-stone-950/50 p-4">
                <p className="font-mono text-[9px] tracking-[0.22em] text-stone-500">当前列表精选</p>
                <p className="mt-3 text-[22px] font-light text-stone-100">{visibleFeaturedCount}</p>
              </div>
            </section>

            {error && (
              <p className="mb-4 border border-red-900/60 bg-red-950/20 px-4 py-3 text-[12px] tracking-[0.08em] text-red-300">
                {error}
              </p>
            )}

            {loading ? (
              <div className="flex flex-1 items-center justify-center py-24 text-[12px] tracking-[0.2em] text-stone-500">
                加载中...
              </div>
            ) : fragments.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-24 text-[12px] tracking-[0.2em] text-stone-500">
                没有匹配的公开碎片。
              </div>
            ) : (
              <section className="grid gap-4 pb-10 lg:grid-cols-2">
                {fragments.map((fragment) => (
                  <article
                    key={fragment.id}
                    className="flex min-h-[260px] flex-col border border-stone-800/80 bg-stone-950/70 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.22)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {fragment.is_featured && (
                            <span className="border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-yellow-200">
                              FEATURED
                            </span>
                          )}
                          {fragment.in_active_featured_pool && (
                            <span className="border border-stone-500/50 bg-stone-800/60 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-stone-200">
                              IN TOP 50
                            </span>
                          )}
                          {fragment.allow_shopkeeper_review && (
                            <span className="border border-stone-700 bg-stone-900/70 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-stone-400">
                              CAN REPLY
                            </span>
                          )}
                        </div>
                        <h2 className="truncate text-[17px] font-light leading-7 tracking-[0.06em] text-stone-100">
                          {fragment.title}
                        </h2>
                      </div>
                      <button
                        type="button"
                        disabled={savingId === fragment.id}
                        onClick={() => toggleFeatured(fragment)}
                        className={`shrink-0 border px-3 py-2 text-[11px] tracking-[0.14em] transition-colors disabled:cursor-wait disabled:opacity-60 ${
                          fragment.is_featured
                            ? 'border-stone-700 bg-stone-950 text-stone-400 hover:border-stone-500 hover:text-stone-100'
                            : 'border-stone-500 bg-stone-200 text-stone-950 hover:bg-white'
                        }`}
                      >
                        {fragment.is_featured ? '移出精选' : '加入精选'}
                      </button>
                    </div>

                    <p className="mt-5 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.04em] text-stone-300">
                      {clampText(fragment.original_content)}
                    </p>

                    {fragment.narration_content && (
                      <p className="mt-5 border-l border-stone-700 pl-4 text-[12px] font-light leading-6 tracking-[0.05em] text-stone-500">
                        {fragment.narration_content}
                      </p>
                    )}

                    {fragment.shopkeeper_comment && (
                      <p className="mt-5 border border-stone-800 bg-stone-900/50 px-4 py-3 text-[12px] leading-6 tracking-[0.05em] text-stone-400">
                        {fragment.shopkeeper_comment}
                      </p>
                    )}

                    <footer className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-stone-800/70 pt-4 font-mono text-[9px] leading-5 tracking-[0.14em] text-stone-500">
                      <span>{formatDate(fragment.created_at)}</span>
                      <span className="max-w-full truncate">{fragment.owner_id}</span>
                    </footer>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
