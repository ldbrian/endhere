'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import type { Fragment } from '../_core/fragments';
import { FEATURED_SEED_FRAGMENTS } from '../_core/fragments';
import { getFeaturedExhibitPool } from '../_core/storage';
import { track } from '../_core/analytics';
import { pickArtifactLineArt } from '../_core/artifacts';

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

export default function V2WorldPage() {
  const [featured, setFeatured] = useState<Fragment>(FEATURED_SEED_FRAGMENTS[0]);
  const [featuredPool, setFeaturedPool] = useState<Fragment[]>(FEATURED_SEED_FRAGMENTS);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [echoedFragmentId, setEchoedFragmentId] = useState<string | null>(null);
  const originalContent = clampOriginalContent(featured.original_content);
  const exhibitQuote = createExhibitQuote(featured.original_content);
  const awakenHref = `/v2/fragments/new?from=exhibit&quote=${encodeURIComponent(exhibitQuote)}`;

  useEffect(() => {
    track('v3_world_view');
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
    track('v3_world_shuffle_tap', {
      fragment_id: featuredPool[nextIndex].id,
      pool_size: featuredPool.length,
    });
  };

  const leaveResonance = () => {
    setEchoedFragmentId(featured.id);
    track('v3_world_resonance_tap', { fragment_id: featured.id });
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-[#1B1614] text-stone-100 selection:bg-stone-700 selection:text-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.055),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.026)_0%,transparent_38%,rgba(255,255,255,0.018)_100%)]" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[430px] flex-col px-8 pb-7 pt-7">
        <header className="flex shrink-0 items-center justify-between border-b border-stone-800/70 pb-5">
          <Link href="/v2" className="text-[11px] tracking-[0.18em] text-stone-500 transition-colors hover:text-stone-200">
            返回
          </Link>
          <span className="font-mono text-[10px] tracking-[0.26em] text-stone-500">THE WORLD</span>
        </header>

        <section className="relative min-h-0 flex-1 py-5">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-x-0 top-7 z-0 mx-auto max-w-[18em] text-center text-[15px] font-light leading-[1.65] tracking-[0.06em] text-stone-500/45"
          >
            这里只陈列碎片。
            <br />
            不提供解释。
          </motion.p>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-[#1B1614]/35 via-[#1B1614]/12 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-[#1B1614]/60 via-[#1B1614]/22 to-transparent" />

          <div className="relative z-10 h-full overflow-y-auto overscroll-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col pb-5 pt-[92px]">
              <motion.article
                key={featured.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
                className="my-auto w-full max-w-[320px] self-center"
              >
                <div className="mb-4 flex items-center justify-between text-[10px] tracking-[0.2em] text-stone-500">
                  <span>FEATURED</span>
                  {originalContent.isClamped && <span className="font-mono tracking-[0.12em] text-stone-600">350 MAX</span>}
                </div>

                <div className="relative rounded-lg border border-stone-800/60 bg-stone-950/80 px-7 py-7 shadow-[0_24px_60px_rgba(50,32,22,0.32)] backdrop-blur-sm">
                  <div className="pointer-events-none absolute inset-x-7 top-4 h-px bg-gradient-to-r from-transparent via-stone-700/70 to-transparent" />
                  <h1 className="text-[19px] font-light leading-9 tracking-[0.06em] text-stone-100">{featured.title}</h1>
                  <p className="mt-4 whitespace-pre-wrap text-[13px] font-light leading-8 tracking-[0.05em] text-stone-300">
                    {originalContent.text}
                  </p>
                  {featured.narration_content && (
                    <p className="mt-5 border-l border-stone-700 pl-4 text-[12px] font-light leading-6 tracking-[0.05em] text-stone-500">
                      {featured.narration_content}
                    </p>
                  )}
                  {featured.meta?.artifact && (() => {
                    const LineArt = pickArtifactLineArt(featured.meta.artifact);
                    return (
                      <div className="mt-5 flex items-center gap-3 border-l border-stone-700 pl-4">
                        <LineArt className="h-7 w-7 shrink-0 text-stone-400" />
                        <div className="min-w-0">
                          <p className="mt-1 text-[12px] font-light leading-6 tracking-[0.05em] text-stone-400">
                            {featured.meta.artifact.name}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                  {featured.shopkeeper_comment && (
                    <div className="mt-5 rounded-md border border-stone-700/45 bg-stone-900/45 px-4 py-3">
                      <p className="mb-2 font-mono text-[9px] tracking-[0.18em] text-stone-600">店长</p>
                      <p className="whitespace-pre-wrap text-[12px] font-light leading-6 tracking-[0.05em] text-stone-300">
                        {featured.shopkeeper_comment}
                      </p>
                    </div>
                  )}
                </div>

                {featuredPool.length > 1 && (
                  <button
                    type="button"
                    onClick={showAnotherFeatured}
                    className="mt-4 block w-full text-center text-[10px] tracking-[0.16em] text-stone-600 transition-colors duration-500 hover:text-stone-300 outline-none"
                  >
                    ↻ 换一张
                  </button>
                )}

                <div className="mt-6 flex items-center justify-center gap-5">
                  <button
                    type="button"
                    onClick={leaveResonance}
                    className="relative border-b border-dashed border-stone-600 pb-0.5 text-[12px] tracking-[0.14em] text-stone-400 transition-colors duration-500 hover:border-stone-300 hover:text-stone-100 outline-none"
                  >
                    产生共鸣
                    <AnimatePresence>
                      {echoedFragmentId === featured.id && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.45, ease: 'easeOut' }}
                          className="pointer-events-none absolute -inset-x-3 -inset-y-2 border border-stone-500/50 shadow-[0_0_24px_rgba(212,212,216,0.22)]"
                        />
                      )}
                    </AnimatePresence>
                  </button>
                  <Link
                    href={awakenHref}
                    onClick={() => track('v3_world_awaken_tap', { fragment_id: featured.id })}
                    className="border-b border-dashed border-stone-500 pb-0.5 text-[12px] tracking-[0.14em] text-stone-200 transition-colors duration-500 hover:border-stone-100 hover:text-white outline-none"
                  >
                    这让我想起...
                  </Link>
                </div>

                <AnimatePresence>
                  {echoedFragmentId === featured.id && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      className="mt-4 text-center text-[10px] tracking-[0.18em] text-stone-500"
                    >
                      已留下回声
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.article>
            </div>
          </div>
        </section>

        <footer className="shrink-0 border-t border-stone-800/70 pt-5 text-center">
          <Link
            href="/v2/fragments/new"
            onClick={() => track('v3_world_leave_fragment_tap', { button: 'leave_fragment', route_to: '/v2/fragments/new' })}
            className="inline-flex items-center justify-center text-[15px] tracking-[0.1em] text-stone-100 transition-colors duration-500 hover:text-white"
          >
            [ 留下一块碎片 ]
          </Link>
        </footer>
      </div>
    </main>
  );
}
