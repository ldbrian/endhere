'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import type { Fragment } from './_core/fragments';
import { FEATURED_SEED_FRAGMENTS } from './_core/fragments';
import { getFeaturedExhibitPool, useFragmentStore } from './_core/storage';
import {
  getLatestShopkeeperReplyAt,
  getReadShopkeeperReplyAt,
  hasUnreadShopkeeperReply,
} from './_core/shopkeeperUnread';
import { supabase } from '../lib/supabase';
import PlasticBag from '../components/PlasticBag';
import { useMigrationProbe } from './_core/useMigrationProbe';
// 🟢 新增：引入埋点工具
import { track } from '../lib/track'; 

type WorldStatusCapsule = {
  id?: string;
  key: string;
  value: string;
};

const ORIGINAL_CONTENT_LIMIT = 350;

const FALLBACK_CAPSULE: WorldStatusCapsule = {
  id: 'fallback-shopkeeper-status',
  key: 'shopkeeper_status',
  value: '正在搜索店长行踪…',
};

function clampOriginalContent(content: string) {
  const characters = Array.from(content);

  if (characters.length <= ORIGINAL_CONTENT_LIMIT) {
    return {
      text: content,
      isClamped: false,
    };
  }

  return {
    text: `${characters.slice(0, ORIGINAL_CONTENT_LIMIT).join('').trimEnd()}...`,
    isClamped: true,
  };
}

export default function V2HomePage() {
  useMigrationProbe(); 
  const router = useRouter();
  const localFragments = useFragmentStore((state) => state.localFragments);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);
  const [featured, setFeatured] = useState<Fragment>(FEATURED_SEED_FRAGMENTS[0]);
  const [featuredPool, setFeaturedPool] = useState<Fragment[]>(FEATURED_SEED_FRAGMENTS);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [worldStatusCapsules, setWorldStatusCapsules] = useState<WorldStatusCapsule[]>([FALLBACK_CAPSULE]);
  const [showSponsorBasket, setShowSponsorBasket] = useState(false);
  const [hasUnreadReply, setHasUnreadReply] = useState(false);
  const originalContent = clampOriginalContent(featured.original_content);
  const fragmentIdKey = localFragments.map((fragment) => fragment.id).join('|');
  const shouldCheckUnreadReplies = hasHydrated && fragmentIdKey.length > 0;

  // 🟢 埋点 1：记录大厅曝光
  useEffect(() => {
    track('v2_home_view');
  }, []);

  useEffect(() => {
    // 今日展柜：拉取精选奖池，首页只展示其中一张，可少量换看。
    getFeaturedExhibitPool().then((pool) => {
      const safePool = pool.length > 0 ? pool : FEATURED_SEED_FRAGMENTS;
      const initialIndex = Math.floor(Math.random() * safePool.length);

      setFeaturedPool(safePool);
      setFeaturedIndex(initialIndex);
      setFeatured(safePool[initialIndex]);
    });
  }, []);

  const showAnotherFeatured = () => {
    if (featuredPool.length <= 1) return;

    let nextIndex = Math.floor(Math.random() * featuredPool.length);
    if (nextIndex === featuredIndex) {
      nextIndex = (nextIndex + 1) % featuredPool.length;
    }

    setFeaturedIndex(nextIndex);
    setFeatured(featuredPool[nextIndex]);
    track('v2_featured_shuffle_tap', {
      fragment_id: featuredPool[nextIndex].id,
      pool_size: featuredPool.length,
    });
  };

  useEffect(() => {
    // 首页胶囊读取当前店长短动态。历史列表在 /v2/shopkeeper 里展开。
    const fetchWorldStatusCapsules = async () => {
      try {
        const { data, error } = await supabase
          .from('world_status')
          .select('key, value')
          .eq('key', 'shopkeeper_status')
          .maybeSingle();

        if (!error && data?.value?.trim()) {
          setWorldStatusCapsules([{ ...data, value: data.value.trim() }]);
        }
      } catch (err) {
        console.error('获取世界状态失败:', err);
      }
    };
    fetchWorldStatusCapsules();
  }, []);

  useEffect(() => {
    const fragmentIds = fragmentIdKey.split('|').filter(Boolean);
    if (!hasHydrated || fragmentIds.length === 0) return;

    const fetchUnreadReplies = async () => {
      try {
        const { data, error } = await supabase
          .from('fragments')
          .select('shopkeeper_comment, updated_at')
          .in('id', fragmentIds);

        if (error || !data) return;

        const latestReplyAt = getLatestShopkeeperReplyAt(data);
        setHasUnreadReply(hasUnreadShopkeeperReply(latestReplyAt, getReadShopkeeperReplyAt()));
      } catch (error) {
        console.error('[Home] fetch unread shopkeeper replies failed:', error);
      }
    };

    fetchUnreadReplies();
  }, [hasHydrated, fragmentIdKey]);

  

  return (
    <main className="relative h-dvh overflow-hidden bg-[#101010] text-zinc-100 selection:bg-zinc-700 selection:text-zinc-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.05),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.026)_0%,transparent_34%,rgba(255,255,255,0.018)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#101010]/90 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#101010]/90 to-transparent" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[430px] flex-col px-8 pb-6 pt-6">
        <header className="flex shrink-0 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3 opacity-80">
            <Image src="/logo.png" alt="End Here Logo" width={20} height={20} className="shrink-0 object-contain" />
            <span className="truncate text-[11px] tracking-[0.24em] text-zinc-400">END HERE</span>
          </div>
          <PlasticBag />
        </header>

        <div className="-mx-8 flex shrink-0 justify-center overflow-x-auto px-8 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-2">
            {worldStatusCapsules.map((capsule, index) => (
              <motion.button
                key={`${capsule.key}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: index * 0.04, ease: 'easeOut' }}
                // 🟢 埋点 2：首页胶囊点击
                onClick={() => {
                  track('v2_world_status_tap', { key: capsule.key });
                  router.push('/v2/shopkeeper');
                }}
                style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px' }}
                className="flex items-center gap-3 rounded-full border border-zinc-700/80 bg-zinc-900/70 transition-colors hover:bg-zinc-800/90 outline-none cursor-pointer"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-500 animate-pulse" />
                <span className="whitespace-nowrap text-[13px] tracking-[0.15em] text-zinc-300 font-mono leading-relaxed">
                  {capsule.value}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <section className="relative min-h-0 flex-1 py-4">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-x-0 top-5 z-0 mx-auto max-w-[18em] text-center text-[15px] font-light leading-[1.65] tracking-[0.06em] text-zinc-500/50"
          >
            这里不解答人生的意义。
            <br />
            只保管人生的体验。
          </motion.p>

          <div className="relative z-10 h-full overflow-y-auto overscroll-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col pb-5 pt-[92px]">
              <motion.article
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, ease: 'easeOut', delay: 0.1 }}
                className="my-auto w-full max-w-[320px] self-center"
              >
                <div className="mb-4 flex items-center justify-between text-[10px] tracking-[0.2em] text-zinc-500">

                  {originalContent.isClamped && (
                    <span className="font-mono tracking-[0.12em] text-zinc-600">350 MAX</span>
                  )}
                </div>

                <div className="relative border border-zinc-800/80 bg-zinc-950/85 px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.48)] backdrop-blur-sm">
                  <div className="pointer-events-none absolute inset-x-6 top-4 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                  <h1 className="text-[19px] font-light leading-8 tracking-[0.06em] text-zinc-100">
                    {featured.title}
                  </h1>
                  <p className="mt-4 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.05em] text-zinc-300">
                    {originalContent.text}
                  </p>
                  {featured.narration_content && (
                    <p className="mt-5 border-l border-zinc-700 pl-4 text-[12px] font-light leading-6 tracking-[0.05em] text-zinc-500">
                      {featured.narration_content}
                    </p>
                  )}
                  {featured.shopkeeper_comment && (
                    <div className="mt-5 rounded-sm border border-zinc-700/60 bg-zinc-900/55 px-4 py-3">
                      <p className="mb-2 font-mono text-[9px] tracking-[0.18em] text-zinc-600">店长</p>
                      <p className="whitespace-pre-wrap text-[12px] font-light leading-6 tracking-[0.05em] text-zinc-300">
                        {featured.shopkeeper_comment}
                      </p>
                    </div>
                  )}
                </div>
                {featuredPool.length > 1 && (
                  <button
                    type="button"
                    onClick={showAnotherFeatured}
                    className="mt-4 block w-full text-right text-[10px] tracking-[0.16em] text-zinc-500 transition-colors duration-500 hover:text-zinc-300 outline-none"
                  >
                    换一张
                  </button>
                )}
                <p className="text-[12px] leading-6 tracking-[0.08em] text-zinc-500 mt-6 w-full text-center opacity-90">
                  这块碎片，
                  <br />
                  是否让你想起了什么？
                </p>
              </motion.article>
            </div>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.22 }}
          className="shrink-0 pb-5 text-center"
        >

          <Link
            href="/v2/fragments/new"
            // 🟢 埋点 3：留碎片点击（核心转化率漏斗起点）
            onClick={() => track('v2_leave_fragment_tap')}
            className="mt-4 inline-flex items-center justify-center text-[16px] tracking-[0.1em] text-zinc-100 transition-colors duration-500 hover:text-white"
          >
            [ 留下一块碎片 ]
          </Link>
        </motion.section>

        <nav className="relative shrink-0 px-1 pb-6">
          <AnimatePresence>
            {showSponsorBasket && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="absolute bottom-[86px] left-1/2 z-20 flex w-[178px] -translate-x-1/2 flex-col items-center border border-zinc-700/80 bg-zinc-950/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
              >
                <div className="h-[150px] w-[150px] border border-zinc-700/80 bg-zinc-900 p-2">
                  <Image
                    src="/pay_code.png"
                    alt="打赏码"
                    width={150}
                    height={150}
                    className="h-full w-full object-contain opacity-90 grayscale"
                  />
                </div>
                <p className="mt-3 text-center text-[9px] leading-5 tracking-[0.16em] text-zinc-500">
                  往铁筐投入一点零钱，让这里能继续亮着。
                </p>
                <a
                  href="/pay_code.png"
                  download="endhere-pay-code.png"
                  onClick={() => track('v2_sponsor_code_save_tap')}
                  className="mt-3 border-t border-zinc-800 px-3 pt-3 text-[10px] tracking-[0.16em] text-zinc-400 transition-colors duration-500 hover:text-zinc-200 outline-none"
                >
                  保存图片
                </a>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 items-center border-t border-zinc-800/80 pt-6 text-[11px] tracking-[0.1em] text-zinc-500">
            <Link 
              href="/v2/nostalgia" 
              // 🟢 埋点 4：底部导航分流 (流向痕迹)
              onClick={() => track('v2_nav_tap', { target: 'nostalgia' })}
              className="relative justify-self-start transition-colors duration-500 hover:text-zinc-300 outline-none"
            >
              我的痕迹
              {shouldCheckUnreadReplies && hasUnreadReply && (
                <span className="absolute -right-3 -top-1 h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.75)]" />
              )}
            </Link>
            <button
              type="button"
              aria-label="装着零钱的铁筐"
              title="装着零钱的铁筐"
              onClick={() => {
                const nextValue = !showSponsorBasket;
                setShowSponsorBasket(nextValue);
                track('v2_sponsor_basket_tap', { open: nextValue });
              }}
              className="group relative flex h-8 w-8 items-center justify-center justify-self-center text-zinc-500 transition-colors duration-500 hover:text-zinc-300 outline-none"
            >
              <span className="absolute top-2 h-1 w-3 rounded-full border border-current opacity-60" />
              <span className="absolute bottom-2 h-3 w-5 border border-current bg-zinc-950/90 transition-colors duration-500 group-hover:bg-zinc-900/90" />
              <span className="absolute bottom-[13px] left-[9px] h-1.5 w-1.5 rounded-full bg-yellow-500/65 shadow-[5px_1px_0_rgba(234,179,8,0.35)]" />
            </button>
            <Link 
              href="/v2/resting" 
              // 🟢 埋点 4：底部导航分流 (流向发呆)
              onClick={() => track('v2_nav_tap', { target: 'resting' })}
              className="justify-self-end transition-colors duration-500 hover:text-zinc-300 outline-none"
            >
              我想坐会儿
            </Link>
          </div>
        </nav>
      </div>
    </main>
  );
}
