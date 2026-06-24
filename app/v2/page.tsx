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

type HomeTab = 'world' | 'mirror';

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

export default function V2HomePage() {
  const [tab, setTab] = useState<HomeTab>('world');

  return (
    <main className="relative h-dvh overflow-hidden bg-[#101010] text-zinc-100 selection:bg-zinc-700 selection:text-zinc-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.055),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.026)_0%,transparent_40%,rgba(255,255,255,0.018)_100%)]" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[430px] flex-col px-7 pb-6 pt-6">
        <header className="shrink-0 border-b border-zinc-800/70 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3 opacity-80">
              <Image src="/logo.png" alt="End Here Logo" width={20} height={20} className="shrink-0 object-contain" />
              <span className="truncate text-[11px] tracking-[0.24em] text-zinc-400">END HERE</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/v2/resting"
                aria-label={'\u6211\u60f3\u5750\u4f1a\u513f'}
                title={'\u6211\u60f3\u5750\u4f1a\u513f'}
                onClick={() => track('v3_header_resting_tap', { target: 'resting' })}
                className="group relative inline-flex h-6 w-6 items-center justify-center text-zinc-600 transition-colors duration-500 hover:text-zinc-300 outline-none"
              >
                <span className="absolute left-[3px] top-[10px] font-mono text-[10px] leading-none tracking-[-0.02em] opacity-80 transition-transform duration-500 group-hover:-translate-y-0.5">
                  Z
                </span>
                <span className="absolute left-[10px] top-[6px] font-mono text-[8px] leading-none tracking-[-0.02em] opacity-55 transition-transform duration-500 group-hover:-translate-y-1">
                  z
                </span>
                <span className="absolute left-[15px] top-[2px] font-mono text-[6px] leading-none tracking-[-0.02em] opacity-35 transition-transform duration-500 group-hover:-translate-y-1.5">
                  z
                </span>
              </Link>
              <V2PlasticBag />
            </div>
          </div>
          <div className="mt-6 flex items-end gap-8">
            {([
              { id: 'world', label: '\u770b\u522b\u4eba', sub: 'THE WORLD' },
              { id: 'mirror', label: '\u770b\u81ea\u5df1', sub: 'THE MIRROR' },
            ] as const).map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    track('v3_home_tab_tap', { tab: item.id });
                  }}
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

        <section className="min-h-0 flex-1 overflow-hidden pt-4">
          <AnimatePresence mode="wait">
            {tab === 'world' ? <WorldPanel key="world" /> : <MirrorPanel key="mirror" />}
          </AnimatePresence>
        </section>
      
        <footer className="shrink-0 border-t border-zinc-800/70 pt-5 text-center">
          <Link
            href="/v2/fragments/new"
            onClick={() => track('v3_home_bottom_leave_fragment_tap', { button: 'leave_fragment', route_to: '/v2/fragments/new' })}
            className="inline-flex items-center justify-center text-[15px] tracking-[0.1em] text-zinc-100 transition-colors duration-500 hover:text-white"
          >
            {'\u7559\u4e0b\u4e00\u5757\u788e\u7247'}
          </Link>
        </footer></div>
    </main>
  );
}

function WorldPanel() {
  const [featured, setFeatured] = useState<Fragment>(FEATURED_SEED_FRAGMENTS[0]);
  const [featuredPool, setFeaturedPool] = useState<Fragment[]>(FEATURED_SEED_FRAGMENTS);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [echoedFragmentId, setEchoedFragmentId] = useState<string | null>(null);
  const originalContent = clampOriginalContent(featured.original_content);
  const exhibitQuote = createExhibitQuote(featured.original_content);
  const awakenHref = `/v2/fragments/new?from=exhibit&quote=${encodeURIComponent(exhibitQuote)}`;

  useEffect(() => {
    getFeaturedExhibitPool().then((pool) => {
      const safePool = pool.length > 0 ? pool : FEATURED_SEED_FRAGMENTS;
      const initialIndex = Math.floor(Math.random() * safePool.length);
      setFeaturedPool(safePool);
      setFeaturedIndex(initialIndex);
      setFeatured(safePool[initialIndex]);
    });
  }, []);

  useEffect(() => {
    if (!echoedFragmentId) return;
    const timer = window.setTimeout(() => setEchoedFragmentId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [echoedFragmentId]);

  const showAnotherFeatured = () => {
    if (featuredPool.length <= 1) return;
    let nextIndex = Math.floor(Math.random() * featuredPool.length);
    if (nextIndex === featuredIndex) nextIndex = (nextIndex + 1) % featuredPool.length;
    setFeaturedIndex(nextIndex);
    setFeatured(featuredPool[nextIndex]);
    track('v3_world_shuffle_tap', { fragment_id: featuredPool[nextIndex].id, pool_size: featuredPool.length });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="relative h-full overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-h-full flex-col pb-6 pt-10">
        <article className="my-auto w-full max-w-[320px] self-center">
          <div className="mb-4 flex items-center justify-between text-[10px] tracking-[0.2em] text-zinc-500">
            <span>FEATURED</span>
            {originalContent.isClamped && <span className="font-mono tracking-[0.12em] text-zinc-600">350 MAX</span>}
          </div>
          <div className="relative border border-zinc-800/80 bg-zinc-950/85 px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.48)] backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-x-6 top-4 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
            <h2 className="text-[19px] font-light leading-8 tracking-[0.06em] text-zinc-100">{featured.title}</h2>
            <p className="mt-4 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.05em] text-zinc-300">{originalContent.text}</p>
            {featured.narration_content && (
              <p className="mt-5 border-l border-zinc-700 pl-4 text-[12px] font-light leading-6 tracking-[0.05em] text-zinc-500">
                {featured.narration_content}
              </p>
            )}
          </div>
          {featuredPool.length > 1 && (
            <button type="button" onClick={showAnotherFeatured} className="mt-4 block w-full text-center text-[10px] tracking-[0.16em] text-zinc-600 transition-colors duration-500 hover:text-zinc-300 outline-none">
              {'\u21bb \u6362\u4e00\u5f20'}
            </button>
          )}
          <div className="mt-6 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => {
                setEchoedFragmentId(featured.id);
                track('v3_world_resonance_tap', { fragment_id: featured.id });
              }}
              className="relative border-b border-dashed border-zinc-600 pb-0.5 text-[12px] tracking-[0.14em] text-zinc-400 transition-colors duration-500 hover:border-zinc-300 hover:text-zinc-100 outline-none"
            >
              {'\u4ea7\u751f\u5171\u9e23'}
            </button>
            <Link href={awakenHref} onClick={() => track('v3_world_awaken_tap', { fragment_id: featured.id })} className="border-b border-dashed border-zinc-500 pb-0.5 text-[12px] tracking-[0.14em] text-zinc-200 transition-colors duration-500 hover:border-zinc-100 hover:text-white outline-none">
              {'\u8fd9\u8ba9\u6211\u60f3\u8d77...'}
            </Link>
          </div>
          <AnimatePresence>
            {echoedFragmentId === featured.id && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} className="mt-4 text-center text-[10px] tracking-[0.18em] text-zinc-500">
                {'\u5df2\u7559\u4e0b\u56de\u58f0'}
              </motion.p>
            )}
          </AnimatePresence>
        </article>
      </div>
    </motion.div>
  );
}

function MirrorPanel() {
  return <MirrorTopicPanel embedded />;
}

