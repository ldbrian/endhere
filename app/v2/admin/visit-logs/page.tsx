'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type VisitLogRow = {
  id: string;
  device_id: string;
  event_name: string;
  is_returning: boolean;
  visit_count: number;
  payload: Record<string, any> | null;
  created_at: string;
};

type VisitLogResponse = {
  logs: VisitLogRow[];
  total: number;
  summary: {
    homeViews: number;
    leaveFragmentTaps: number;
    fragmentNewViews: number;
    privateFragmentSaves: number;
  };
};

const ADMIN_TOKEN_KEY = 'endhere_v2_featured_admin_token';

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
    second: '2-digit',
    hour12: false,
  });
}

function shortPayload(payload: Record<string, any> | null) {
  if (!payload) return '';
  const route = payload.path || payload.url || '';
  const referrer = payload.referrer_path || payload.referrer || '';
  const target = payload.target || payload.button || payload.key || '';
  const stay = typeof payload.stay_ms === 'number' ? `${Math.round(payload.stay_ms / 1000)}s` : '';
  return [route, referrer ? `from ${referrer}` : '', target ? `target ${target}` : '', stay ? `stay ${stay}` : '']
    .filter(Boolean)
    .join(' · ');
}

export default function VisitLogsPage() {
  const [token, setToken] = useState(getSavedAdminToken);
  const [draftToken, setDraftToken] = useState(getSavedAdminToken);
  const [eventName, setEventName] = useState('');
  const [route, setRoute] = useState('');
  const [date, setDate] = useState('');
  const [returning, setReturning] = useState<'all' | 'new' | 'returning'>('all');
  const [logs, setLogs] = useState<VisitLogRow[]>([]);
  const [summary, setSummary] = useState<VisitLogResponse['summary']>({
    homeViews: 0,
    leaveFragmentTaps: 0,
    fragmentNewViews: 0,
    privateFragmentSaves: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (eventName.trim()) params.set('event', eventName.trim());
      if (route.trim()) params.set('route', route.trim());
      if (date.trim()) params.set('date', date.trim());
      if (returning !== 'all') params.set('returning', returning);

      const response = await fetch(`/v2/admin/visit-logs-data?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      const data = (await response.json()) as VisitLogResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || 'FETCH_FAILED');

      setLogs(data.logs);
      setTotal(data.total);
      setSummary(data.summary);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [date, eventName, returning, route, token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetchLogs(controller.signal);
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [fetchLogs, token]);

  const saveToken = () => {
    const nextToken = draftToken.trim();
    window.localStorage.setItem(ADMIN_TOKEN_KEY, nextToken);
    setToken(nextToken);
  };

  const clearToken = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken('');
    setDraftToken('');
    setLogs([]);
    setError('');
  };

  const visibleRoute = useMemo(() => route.trim() || 'ALL', [route]);

  return (
    <main className="min-h-dvh bg-[#101010] text-zinc-100 selection:bg-zinc-700 selection:text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.045),transparent_38%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
          <div>
            <Link href="/v2" className="text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-200">
              返回首页
            </Link>
            <h1 className="mt-4 text-[20px] font-light tracking-[0.12em] text-zinc-100">访问日志</h1>
          </div>
          <div className="text-right font-mono text-[10px] leading-5 tracking-[0.16em] text-zinc-500">
            <p>TOTAL {total}</p>
            <p>ROUTE {visibleRoute}</p>
          </div>
        </header>

        {!token ? (
          <section className="flex flex-1 items-center justify-center py-20">
            <div className="w-full max-w-sm border border-zinc-800/80 bg-zinc-950/80 px-6 py-7 shadow-[0_22px_70px_rgba(0,0,0,0.36)]">
              <p className="font-mono text-[10px] tracking-[0.24em] text-zinc-500">ADMIN ACCESS</p>
              <input
                value={draftToken}
                onChange={(event) => setDraftToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveToken();
                }}
                type="password"
                placeholder="输入后台口令"
                className="mt-8 w-full border-b border-zinc-800 bg-transparent pb-3 text-[14px] tracking-[0.08em] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={saveToken}
                className="mt-8 text-[13px] tracking-[0.18em] text-zinc-200 transition-colors hover:text-white"
              >
                进入
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 border-b border-zinc-800/70 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="grid gap-3 sm:grid-cols-4">
                <input
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value)}
                  placeholder="event name"
                  className="h-10 min-w-0 border border-zinc-800 bg-zinc-950/50 px-4 text-[13px] tracking-[0.08em] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                />
                <input
                  value={route}
                  onChange={(event) => setRoute(event.target.value)}
                  placeholder="route / path"
                  className="h-10 min-w-0 border border-zinc-800 bg-zinc-950/50 px-4 text-[13px] tracking-[0.08em] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                />
                <input
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="h-10 min-w-0 border border-zinc-800 bg-zinc-950/50 px-4 text-[13px] tracking-[0.08em] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                />
                <select
                  value={returning}
                  onChange={(event) => setReturning(event.target.value as typeof returning)}
                  className="h-10 min-w-0 border border-zinc-800 bg-zinc-950/50 px-4 text-[13px] tracking-[0.08em] text-zinc-100 outline-none focus:border-zinc-500"
                >
                  <option value="all">all</option>
                  <option value="new">new</option>
                  <option value="returning">returning</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fetchLogs()}
                  className="text-[12px] tracking-[0.16em] text-zinc-300 transition-colors hover:text-white"
                >
                  刷新
                </button>
                <button
                  type="button"
                  onClick={clearToken}
                  className="text-[12px] tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  退出
                </button>
              </div>
            </section>

            <section className="grid gap-4 py-5 sm:grid-cols-4">
              <div className="border border-zinc-800/70 bg-zinc-950/50 p-4">
                <p className="font-mono text-[9px] tracking-[0.22em] text-zinc-500">HOME VIEW</p>
                <p className="mt-3 text-[22px] font-light text-zinc-100">{summary.homeViews}</p>
              </div>
              <div className="border border-zinc-800/70 bg-zinc-950/50 p-4">
                <p className="font-mono text-[9px] tracking-[0.22em] text-zinc-500">LEAVE FRAGMENT</p>
                <p className="mt-3 text-[22px] font-light text-zinc-100">{summary.leaveFragmentTaps}</p>
              </div>
              <div className="border border-zinc-800/70 bg-zinc-950/50 p-4">
                <p className="font-mono text-[9px] tracking-[0.22em] text-zinc-500">FRAGMENT NEW VIEW</p>
                <p className="mt-3 text-[22px] font-light text-zinc-100">{summary.fragmentNewViews}</p>
              </div>
              <div className="border border-zinc-800/70 bg-zinc-950/50 p-4">
                <p className="font-mono text-[9px] tracking-[0.22em] text-zinc-500">PRIVATE SAVES</p>
                <p className="mt-3 text-[22px] font-light text-zinc-100">{summary.privateFragmentSaves}</p>
              </div>
            </section>

            {error && (
              <p className="mb-4 border border-red-900/60 bg-red-950/20 px-4 py-3 text-[12px] tracking-[0.08em] text-red-300">
                {error}
              </p>
            )}

            {loading ? (
              <div className="flex flex-1 items-center justify-center py-24 text-[12px] tracking-[0.2em] text-zinc-500">
                加载中...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-24 text-[12px] tracking-[0.2em] text-zinc-500">
                没有匹配的日志。
              </div>
            ) : (
              <section className="overflow-hidden border border-zinc-800/70">
                <div className="grid grid-cols-[160px_170px_110px_110px_1fr] gap-0 border-b border-zinc-800/70 bg-zinc-950/70 px-4 py-3 text-[10px] tracking-[0.2em] text-zinc-500">
                  <span>TIME</span>
                  <span>EVENT</span>
                  <span>RETURNING</span>
                  <span>VISITS</span>
                  <span>DETAIL</span>
                </div>
                <div className="divide-y divide-zinc-900">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-[160px_170px_110px_110px_1fr] gap-0 px-4 py-3 text-[12px] leading-6 text-zinc-300"
                    >
                      <span className="font-mono text-[10px] text-zinc-500">{formatDate(log.created_at)}</span>
                      <span className="truncate font-mono text-[10px] tracking-[0.12em] text-zinc-200">{log.event_name}</span>
                      <span className="font-mono text-[10px] tracking-[0.12em] text-zinc-500">
                        {log.is_returning ? 'YES' : 'NO'}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.12em] text-zinc-500">{log.visit_count}</span>
                      <span className="truncate text-[11px] tracking-[0.05em] text-zinc-400">
                        {shortPayload(log.payload)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
