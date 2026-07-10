'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Fragment } from '../_core/fragments';
import { supabase } from '../../lib/supabase';

type ShopkeeperView = 'status' | 'observations';

type StatusLog = {
  id?: string;
  key?: string;
  value: string;
  created_at?: string;
  updated_at?: string;
};

const VIEW_OPTIONS: { id: ShopkeeperView; label: string }[] = [
  { id: 'status', label: '此时此刻' },
  { id: 'observations', label: '往日观察' },
];

function formatLogDate(value?: string) {
  if (!value) return 'TIME UNKNOWN';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TIME UNKNOWN';

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function V2ShopkeeperPage() {
  const [activeView, setActiveView] = useState<ShopkeeperView>('status');
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [observations, setObservations] = useState<Fragment[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingObservations, setLoadingObservations] = useState(true);

  useEffect(() => {
    const fetchStatusLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('shopkeeper_logs')
          .select('id, content, created_at')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setStatusLogs(
            data
              .filter((item) => typeof item.content === 'string' && item.content.trim())
              .map((item) => ({
                id: item.id,
                value: item.content.trim(),
                created_at: item.created_at,
              }))
          );
        }
      } catch (e) {
        console.error('[ShopkeeperPage] fetch status logs error:', e);
      } finally {
        setLoadingStatus(false);
      }
    };

    const fetchObservations = async () => {
      try {
        const { data, error } = await supabase
          .from('fragments')
          .select('*')
          .eq('owner_id', 'system_shopkeeper')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setObservations(data as Fragment[]);
        }
      } catch (e) {
        console.error('[ShopkeeperPage] fetch observations error:', e);
      } finally {
        setLoadingObservations(false);
      }
    };

    fetchStatusLogs();
    fetchObservations();
  }, []);

  const isLoading = activeView === 'status' ? loadingStatus : loadingObservations;
  const isEmpty = activeView === 'status' ? statusLogs.length === 0 : observations.length === 0;

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center bg-[#1B1614] font-mono text-stone-100 selection:bg-stone-700 selection:text-stone-50">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_40%)]" />

      <header className="absolute left-0 right-0 top-0 z-30 flex h-24 items-center justify-center bg-gradient-to-b from-[#1B1614] via-[#1B1614]/85 to-transparent">
        <div className="flex w-full max-w-[430px] items-center justify-between px-8">
          <Link href="/v2" className="text-[11px] tracking-[0.18em] text-stone-500 transition-colors duration-500 hover:text-stone-200 outline-none">
            返回
          </Link>
          <span className="text-[10px] tracking-[0.24em] text-stone-500">SHOPKEEPER ROOM</span>
        </div>
      </header>

      <div className="relative z-10 flex w-full max-w-[430px] flex-1 flex-col overflow-y-auto px-8 pb-24 pt-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mb-10 flex flex-col items-center text-center">
          <h1 className="mb-4 text-[15px] font-light tracking-[0.2em] text-stone-300">店长室</h1>
          <p className="max-w-[22em] text-[11px] leading-relaxed tracking-[0.15em] text-stone-500">
            一边是此刻的短句，一边是往日留下的观察。
          </p>
        </div>

        <div className="mb-10 grid grid-cols-2 border border-stone-800/80 bg-stone-950/65 p-1">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveView(option.id)}
              className={`px-3 py-2 text-[11px] tracking-[0.16em] transition-colors duration-500 outline-none ${
                activeView === option.id
                  ? 'bg-stone-800/80 text-stone-200'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="mt-10 text-center text-[11px] tracking-widest text-stone-500">...</p>
        ) : isEmpty ? (
          <p className="mt-10 text-center text-[11px] tracking-widest text-stone-500">
            这里暂时还是空的。
          </p>
        ) : activeView === 'status' ? (
          <div className="flex flex-col gap-8">
            {statusLogs.map((log, index) => (
              <motion.article
                key={log.id ?? `${log.key ?? 'status'}-${log.created_at ?? index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.025, ease: 'easeOut' }}
                className="border-l border-stone-800 pl-4"
              >
                <time className="mb-3 block text-[9px] tracking-[0.22em] text-stone-500">
                  {formatLogDate(log.created_at ?? log.updated_at)}
                </time>
                <p className="whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.08em] text-stone-300">
                  {log.value}
                </p>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {observations.map((fragment, index) => (
              <motion.article
                key={fragment.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.035, ease: 'easeOut' }}
                className="rounded-lg border border-stone-800/60 bg-stone-950/70 px-7 py-7 shadow-[0_18px_50px_rgba(50,32,22,0.28)]"
              >
                <time className="mb-5 block text-[9px] tracking-[0.22em] text-stone-500">
                  {formatLogDate(fragment.created_at)}
                </time>
                <h2 className="text-[18px] font-light leading-8 tracking-[0.06em] text-stone-100">
                  {fragment.title}
                </h2>
                <p className="mt-4 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.05em] text-stone-300">
                  {fragment.original_content}
                </p>
                {fragment.narration_content && (
                  <p className="mt-5 border-l border-stone-700 pl-4 text-[12px] font-light leading-6 tracking-[0.05em] text-stone-500">
                    {fragment.narration_content}
                  </p>
                )}
              </motion.article>
            ))}
          </div>
        )}

        <div className="mt-14 text-center text-[10px] tracking-[0.3em] text-stone-600 opacity-70">
          END HERE
        </div>
      </div>
    </main>
  );
}
