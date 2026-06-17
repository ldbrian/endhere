'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Fragment } from './_core/fragments';
import { FEATURED_SEED_FRAGMENTS } from './_core/fragments';
import { getFeaturedExhibit } from './_core/storage';
import { useSpaceStore, type Scene } from '../store/useSpaceStore';
import { supabase } from '../lib/supabase';
import PlasticBag from '../components/PlasticBag';
import { useMigrationProbe } from './_core/useMigrationProbe';
// 🟢 新增：引入埋点工具
import { track } from '../lib/track'; 

export default function V2HomePage() {
  useMigrationProbe(); 
  const router = useRouter();
  const [featured, setFeatured] = useState<Fragment>(FEATURED_SEED_FRAGMENTS[0]);
  const [shopkeeperStatus, setShopkeeperStatus] = useState('');

  // 🟢 埋点 1：记录大厅曝光
  useEffect(() => {
    track('v2_home_view');
  }, []);

  useEffect(() => {
    // 今日展柜：异步从云端拉取
    getFeaturedExhibit().then((exhibit) => {
      setFeatured(exhibit);
    });
  }, []);

  useEffect(() => {
    // 店长胶囊状态拉取
    const fetchShopkeeperStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('world_status')
          .select('value')
          .eq('key', 'shopkeeper_status')
          .single();

        if (!error && data?.value) {
          setShopkeeperStatus(data.value);
        }
      } catch (err) {
        console.error('获取店长状态失败:', err);
      }
    };
    fetchShopkeeperStatus();
  }, []);

  

  return (
    <main className="relative h-dvh overflow-hidden bg-[#080808] text-zinc-200 selection:bg-zinc-800 selection:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.035),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.018)_0%,transparent_34%,rgba(255,255,255,0.012)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[430px] flex-col px-8 pb-6 pt-6">
        <header className="flex shrink-0 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3 opacity-60">
            <Image src="/logo.png" alt="End Here Logo" width={20} height={20} className="shrink-0 object-contain" />
            <span className="truncate text-[11px] tracking-[0.24em] text-zinc-500">END HERE</span>
          </div>
          <PlasticBag />
        </header>

        <div className="flex shrink-0 justify-center pt-3">
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            // 🟢 埋点 2：店长状态点击
            onClick={() => {
              track('v2_shopkeeper_tap');
              router.push('/v2/shopkeeper'); // 🟢 CTO 修复：直接利用 Next.js 路由跳转至新页面
            }}
            style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px' }}
            className="flex items-center gap-4 rounded-full border border-zinc-800 bg-zinc-900/50 transition-colors hover:bg-zinc-800/80 outline-none cursor-pointer"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-500 animate-pulse" />
            <span className="whitespace-nowrap text-[13px] tracking-[0.15em] text-zinc-300 font-mono leading-relaxed">
              {shopkeeperStatus}
            </span>
          </motion.button>
        </div>

        <section className="flex shrink-0 flex-col items-center pt-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            className="max-w-[18em] text-[16px] font-light leading-[1.7] tracking-[0.06em] text-zinc-300"
          >
            这里不解答人生的意义。
            <br />
            只保管人生的体验。
          </motion.p>
        </section>

        <section className="flex flex-1 flex-col items-center justify-center py-6">
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut', delay: 0.1 }}
            className="w-full max-w-[320px]"
          >
            <div className="mb-4 flex items-center justify-between text-[10px] tracking-[0.2em] text-zinc-700">
              <span>今日展柜</span>
            </div>

            <div className="relative border border-zinc-900/90 bg-zinc-950/30 px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
              <div className="pointer-events-none absolute inset-x-6 top-4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
              <h1 className="text-[19px] font-light leading-8 tracking-[0.06em] text-zinc-100">
                {featured.title}
              </h1>
              <p className="mt-4 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.05em] text-zinc-400">
                {featured.original_content}
              </p>
              {featured.narration_content && (
                <p className="mt-5 border-l border-zinc-800 pl-4 text-[12px] font-light leading-6 tracking-[0.05em] text-zinc-600">
                  {featured.narration_content}
                </p>
              )}
            </div>
          </motion.article>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.22 }}
            className="mt-6 flex flex-col items-center text-center"
          >
            <p className="text-[12px] leading-6 tracking-[0.08em] text-zinc-600">
              这块碎片，
              <br />
              是否让你想起了什么？
            </p>
            <Link
              href="/v2/fragments/new"
              // 🟢 埋点 3：留碎片点击（核心转化率漏斗起点）
              onClick={() => track('v2_leave_fragment_tap')}
              className="mt-5 text-[16px] tracking-[0.1em] text-zinc-100 transition-colors duration-500 hover:text-white"
            >
              [ 留下一块碎片 ]
            </Link>
          </motion.div>
        </section>

        <nav className="shrink-0 px-1 pb-6">
          <div className="mx-auto flex w-full max-w-[280px] items-center justify-between border-t border-zinc-900 pt-6 text-[11px] tracking-[0.1em] text-zinc-600">
            <Link 
              href="/v2/nostalgia" 
              // 🟢 埋点 4：底部导航分流 (流向痕迹)
              onClick={() => track('v2_nav_tap', { target: 'nostalgia' })}
              className="transition-colors duration-500 hover:text-zinc-300 outline-none"
            >
              我的痕迹
            </Link>
            <Link 
              href="/v2/resting" 
              // 🟢 埋点 4：底部导航分流 (流向发呆)
              onClick={() => track('v2_nav_tap', { target: 'resting' })}
              className="transition-colors duration-500 hover:text-zinc-300 outline-none"
            >
              我想坐会儿
            </Link>
          </div>
        </nav>
      </div>
    </main>
  );
}