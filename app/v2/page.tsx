'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import type { Fragment } from './_core/fragments';
import { FEATURED_SEED_FRAGMENTS } from './_core/fragments';
import { getFeaturedExhibitPool } from './_core/storage';
import { track } from './_core/analytics';
import { MirrorTopicPanel } from './_core/MirrorTopicPanel';
import V2PlasticBag from './_core/V2PlasticBag';
import { supabase } from '../lib/supabase';

// ============================================================
// Tab 类型 & 本地记忆键
// ============================================================

type HomeTab = 'write' | 'world' | 'mirror';

const LAST_TAB_KEY = 'endhere_v2_last_tab';
const VALID_TABS: HomeTab[] = ['write', 'world', 'mirror'];

function readLastTab(): HomeTab {
  if (typeof window === 'undefined') return 'write';
  const saved = window.localStorage.getItem(LAST_TAB_KEY);
  return VALID_TABS.includes(saved as HomeTab) ? (saved as HomeTab) : 'write';
}

function saveLastTab(tab: HomeTab) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_TAB_KEY, tab);
}

// ============================================================
// 工具函数
// ============================================================

const ORIGINAL_CONTENT_LIMIT = 350;
const EXHIBIT_QUOTE_LIMIT = 48;

function clampOriginalContent(content: string) {
  const characters = Array.from(content);
  if (characters.length <= ORIGINAL_CONTENT_LIMIT) return { text: content, isClamped: false };
  return { text: `${characters.slice(0, ORIGINAL_CONTENT_LIMIT).join('').trimEnd()}...`, isClamped: true };
}

function createExhibitQuote(content: string) {
  const firstLine = content.trim().split(/\n+/)[0] || content;
  const characters = Array.from(firstLine.trim());
  if (characters.length <= EXHIBIT_QUOTE_LIMIT) return firstLine.trim();
  return `${characters.slice(0, EXHIBIT_QUOTE_LIMIT).join('').trimEnd()}...`;
}

// ============================================================
// Tab 配置
// ============================================================

const TABS: { id: HomeTab; label: string; sub: string }[] = [
  { id: 'write', label: '留一笔', sub: 'LEAVE A MARK' },
  { id: 'world', label: '看别人', sub: 'THE WORLD' },
  { id: 'mirror', label: '看自己', sub: 'THE MIRROR' },
];

// ============================================================
// 主页组件
// ============================================================

type ShopkeeperCapsule = { id?: string; content: string };

export default function V2HomePage() {
  // 首次渲染用 'write'，hydration 后从 localStorage 恢复
  const [tab, setTab] = useState<HomeTab>('write');
  const [hydrated, setHydrated] = useState(false);
  const [shopkeeperCapsule, setShopkeeperCapsule] = useState<ShopkeeperCapsule | null>(null);
  const [isShopkeeperCapsuleDismissed, setIsShopkeeperCapsuleDismissed] = useState(false);

  // Hydration：读取用户上次 tab
  useEffect(() => {
    const last = readLastTab();
    setTab(last);
    setHydrated(true);
  }, []);

  // 切 tab 时同时持久化
  const switchTab = (next: HomeTab) => {
    setTab(next);
    saveLastTab(next);
    track('v3_home_tab_tap', { tab: next });
  };

  // 店主胶囊
  useEffect(() => {
    const fetchShopkeeperCapsule = async () => {
      try {
        const { data, error } = await supabase
          .from('shopkeeper_logs')
          .select('id, content, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && typeof data?.content === 'string' && data.content.trim()) {
          setShopkeeperCapsule({ id: data.id, content: data.content.trim() });
        }
      } catch (error) {
        console.error('[V2HomePage] fetch shopkeeper capsule failed:', error);
      }
    };

    fetchShopkeeperCapsule();
  }, []);

  return (
    <main className="relative h-dvh overflow-hidden bg-[#101010] text-zinc-100 selection:bg-zinc-700 selection:text-zinc-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.055),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.026)_0%,transparent_40%,rgba(255,255,255,0.018)_100%)]" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[430px] flex-col px-7 pb-6 pt-6">

        {/* ── Header ── */}
        <header className="shrink-0 border-b border-zinc-800/70 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3 opacity-80">
              <Image src="/logo.png" alt="End Here Logo" width={20} height={20} className="shrink-0 object-contain" />
              <span className="truncate text-[11px] tracking-[0.24em] text-zinc-400">END HERE</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/v2/resting"
                aria-label="我想坐会儿"
                title="我想坐会儿"
                onClick={() => track('v3_header_resting_tap', { target: 'resting' })}
                className="group relative inline-flex h-6 w-6 items-center justify-center text-zinc-600 transition-colors duration-500 hover:text-zinc-300 outline-none"
              >
                <span className="absolute left-[3px] top-[10px] font-mono text-[10px] leading-none tracking-[-0.02em] opacity-80 transition-transform duration-500 group-hover:-translate-y-0.5">Z</span>
                <span className="absolute left-[10px] top-[6px] font-mono text-[8px] leading-none tracking-[-0.02em] opacity-55 transition-transform duration-500 group-hover:-translate-y-1">z</span>
                <span className="absolute left-[15px] top-[2px] font-mono text-[6px] leading-none tracking-[-0.02em] opacity-35 transition-transform duration-500 group-hover:-translate-y-1.5">z</span>
              </Link>
              <V2PlasticBag />
            </div>
          </div>

          {/* 店主胶囊 */}
          {shopkeeperCapsule && !isShopkeeperCapsuleDismissed && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="mt-4"
            >
              <div className="flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-zinc-700/70 bg-zinc-950/45 px-3 py-2 text-zinc-400 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-colors duration-500 hover:border-zinc-600">
                <Link
                  href="/v2/shopkeeper"
                  onClick={() => track('v3_shopkeeper_capsule_tap', { id: shopkeeperCapsule.id })}
                  className="flex min-w-0 flex-1 items-center gap-3 transition-colors duration-500 hover:text-zinc-200 outline-none"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400/80 shadow-[0_0_10px_rgba(212,212,216,0.38)]" />
                  <span className="truncate text-[11px] font-light tracking-[0.12em]">{shopkeeperCapsule.content}</span>
                </Link>
                <button
                  type="button"
                  aria-label="关闭店长胶囊"
                  title="关闭"
                  onClick={() => {
                    setIsShopkeeperCapsuleDismissed(true);
                    track('v3_shopkeeper_capsule_close_tap', { id: shopkeeperCapsule.id });
                  }}
                  className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors duration-500 hover:bg-zinc-800/70 hover:text-zinc-300 outline-none"
                >
                  <span className="text-[13px] leading-none" aria-hidden="true">×</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Tab 栏 */}
          <div className="mt-6 flex items-end gap-8">
            {TABS.map((item) => {
              const active = hydrated ? tab === item.id : item.id === 'write';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`border-b pb-2 text-left transition-colors duration-500 ${
                    active
                      ? 'border-zinc-100 text-zinc-50 drop-shadow-[0_0_10px_rgba(244,244,245,0.12)]'
                      : 'border-transparent text-zinc-500/70 hover:text-zinc-300'
                  }`}
                >
                  <span className="block text-[14px] tracking-[0.12em]">{item.label}</span>
                  <span className="mt-1 block font-mono text-[8px] tracking-[0.22em] opacity-45">{item.sub}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* ── Content ── */}
        <section className="min-h-0 flex-1 overflow-hidden pt-4">
          <AnimatePresence mode="wait">
            {tab === 'write' && <WritePanel key="write" />}
            {tab === 'world' && <WorldPanel key="world" />}
            {tab === 'mirror' && <MirrorPanel key="mirror" />}
          </AnimatePresence>
        </section>

      </div>
    </main>
  );
}

// ============================================================
// WritePanel — 留一笔
// ============================================================

// 最近有人写下的碎片快照（首行，最多 18 字）
function createSnippet(content: string): string {
  const firstLine = content.trim().split(/\n+/)[0] || content;
  const chars = Array.from(firstLine.trim());
  return chars.length > 18 ? chars.slice(0, 18).join('') + '…' : firstLine.trim();
}

// 兜底种子——保证空状态下也有存在感
const FALLBACK_SNIPPETS = [
  '雨停的时候很安静',
  '不想再想那个人了',
  '地铁上突然很困',
];

function WritePanel() {
  const [snippets, setSnippets] = useState<string[]>(FALLBACK_SNIPPETS);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const { data, error } = await supabase
          .from('fragments')
          .select('original_content')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(6);

        if (!error && data && data.length >= 3) {
          const picked: string[] = [];
          for (const row of data) {
            const s = createSnippet(String(row.original_content || ''));
            if (s.length > 2) picked.push(s);
            if (picked.length === 3) break;
          }
          if (picked.length === 3) setSnippets(picked);
        }
      } catch {
        // 静默降级到 FALLBACK_SNIPPETS
      }
    };

    fetchRecent();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="relative flex h-full flex-col px-1 pt-6 pb-4"
    >
      <div className="w-full max-w-[320px] self-center flex flex-col gap-8">

        {/* Layer 1：场域句 */}
        <p className="text-[13px] font-light leading-8 tracking-[0.14em] text-zinc-400">
          今天也会成为过去。
        </p>

        {/* Layer 2：存在证据 */}
        <div className="flex flex-col gap-3">
          {snippets.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.08 }}
              className="flex items-start gap-3"
            >
              <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-zinc-700" />
              <span className="text-[12px] font-light leading-6 tracking-[0.06em] text-zinc-500">
                有人写：{s}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Layer 3 + 4：入口 + 动作 */}
        <div className="flex flex-col gap-4">
          <Link
            href="/v2/fragments/new"
            onClick={() => track('v3_write_panel_tap', { button: 'leave_mark' })}
            className="group flex items-center justify-between border-b border-zinc-800 pb-4 transition-colors duration-500 hover:border-zinc-600 outline-none"
          >
            <span className="text-[12px] font-light tracking-[0.1em] text-zinc-500 transition-colors duration-500 group-hover:text-zinc-300">
              今天这一刻是……
            </span>
            <span className="text-[13px] tracking-[0.16em] text-zinc-200 transition-colors duration-500 group-hover:text-white">
              留一笔 →
            </span>
          </Link>
          <p className="text-[10px] tracking-[0.18em] text-zinc-700">
            一句话就够。
          </p>
        </div>

      </div>
    </motion.div>
  );
}

// ============================================================
// WorldPanel — 看别人（展馆模式）
// ============================================================

type WorldObservation = {
  id: string;
  title: string;
  body: string;
};

type SystemFragment = {
  id: string;
  content: string;
};

function pickSystemFragment(fragments: SystemFragment[], anchorId: string): SystemFragment | null {
  if (fragments.length === 0) return null;
  const seed = anchorId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return fragments[seed % fragments.length];
}

function WorldPanel() {
  const [observation, setObservation] = useState<WorldObservation | null>(null);
  const [systemFragment, setSystemFragment] = useState<SystemFragment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorld = async () => {
      try {
        const { data: logs, error: logsError } = await supabase
          .from('shopkeeper_logs')
          .select('id, title, content, created_at')
          .not('title', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!logsError && logs && typeof logs.title === 'string' && logs.title.trim()) {
          setObservation({
            id: String(logs.id),
            title: logs.title.trim(),
            body: typeof logs.content === 'string' ? logs.content.trim() : '',
          });

          const { data: sysFragments, error: sysError } = await supabase
            .from('fragments')
            .select('id, original_content')
            .eq('is_featured', true)
            .filter('meta->>source', 'eq', 'system')
            .limit(20);

          if (!sysError && sysFragments && sysFragments.length > 0) {
            const pool: SystemFragment[] = sysFragments
              .map((f) => ({ id: String(f.id), content: String(f.original_content || '').trim() }))
              .filter((f) => f.content.length > 0);
            const picked = pickSystemFragment(pool, String(logs.id));
            if (picked) setSystemFragment(picked);
          }
        }
      } catch (err) {
        console.error('[WorldPanel] fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorld();
    track('v3_world_view');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="relative h-full overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex flex-col pb-10 pt-4 w-full max-w-[320px] mx-auto">

        {loading ? (
          <p className="text-[11px] tracking-[0.18em] text-zinc-700 mt-6">正在打开展馆…</p>
        ) : !observation ? (
          <div className="mt-10 flex flex-col gap-4">
            <p className="text-[13px] font-light leading-8 tracking-[0.1em] text-zinc-500">
              展馆尚未开放。
            </p>
            <p className="text-[11px] tracking-[0.16em] text-zinc-700">
              值得被看见的观察，需要时间。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <p className="font-mono text-[9px] tracking-[0.26em] text-zinc-700 mb-5">
                世界留下了……
              </p>
              <h2 className="text-[20px] font-light leading-9 tracking-[0.08em] text-zinc-100">
                {observation.title}
              </h2>
            </motion.div>

            <div className="h-px bg-zinc-800/80" />

            {observation.body && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                className="flex flex-col gap-4"
              >
                <span className="font-mono text-[9px] tracking-[0.22em] text-zinc-600">
                  店主
                </span>
                <p className="text-[13px] font-light leading-8 tracking-[0.06em] text-zinc-300 whitespace-pre-wrap">
                  {observation.body}
                </p>
              </motion.div>
            )}

            {systemFragment && <div className="h-px bg-zinc-800/80" />}

            {systemFragment && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
                className="flex flex-col gap-4"
              >
                <span className="font-mono text-[9px] tracking-[0.22em] text-zinc-600">
                  END HERE
                </span>
                <p className="text-[13px] font-light leading-8 tracking-[0.1em] text-zinc-400 whitespace-pre-wrap">
                  {systemFragment.content}
                </p>
              </motion.div>
            )}

          </div>
        )}

      </div>
    </motion.div>
  );
}

// ============================================================
// MirrorPanel — 看自己
// ============================================================

function MirrorPanel() {
  return <MirrorTopicPanel embedded />;
}
