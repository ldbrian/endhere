'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useFragmentStore } from '../_core/storage';
import type { Fragment } from '../_core/fragments';
import {
  getLatestShopkeeperReplyAt,
  markShopkeeperRepliesRead,
} from '../_core/shopkeeperUnread';
import { supabase } from '../../lib/supabase';

const getFuzzyTime = (timestamp: string): string => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = diff / (1000 * 60 * 60);
  const days = diff / (1000 * 60 * 60 * 24);
  if (hours < 1) return '刚刚';
  if (hours < 24) return '今天';
  if (days < 2) return '昨天';
  if (days < 7) return '几天前';
  if (days < 30) return '几周前';
  if (days < 365) return '几个月前';
  return '很久以前';
};

export default function V2NostalgiaPage() {
  const localFragments = useFragmentStore((state) => state.localFragments);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);
  const mergeShopkeeperComments = useFragmentStore((state) => state.mergeShopkeeperComments);
  const [featuredFragmentIds, setFeaturedFragmentIds] = useState<Set<string>>(new Set());
  const fragmentIdKey = useMemo(
    () => localFragments.map((fragment) => fragment.id).join('|'),
    [localFragments]
  );

  useEffect(() => {
    const fragmentIds = fragmentIdKey.split('|').filter(Boolean);
    if (!hasHydrated || fragmentIds.length === 0) return;

    const fetchShopkeeperComments = async () => {
      try {
        const { data, error } = await supabase
          .from('fragments')
          .select('id, shopkeeper_comment, updated_at')
          .in('id', fragmentIds);

        if (error || !data) return;

        const comments = data.reduce<Record<string, string | null>>((acc, item) => {
          if (typeof item.id === 'string') {
            acc[item.id] = typeof item.shopkeeper_comment === 'string' ? item.shopkeeper_comment : null;
          }
          return acc;
        }, {});

        mergeShopkeeperComments(comments);
        markShopkeeperRepliesRead(getLatestShopkeeperReplyAt(data));
      } catch (error) {
        console.error('[Nostalgia] sync shopkeeper comments failed:', error);
      }
    };

    fetchShopkeeperComments();
  }, [hasHydrated, fragmentIdKey, mergeShopkeeperComments]);

  useEffect(() => {
    const fragmentIds = fragmentIdKey.split('|').filter(Boolean);
    if (!hasHydrated || fragmentIds.length === 0) return;

    const fetchFeaturedFragments = async () => {
      try {
        const { data, error } = await supabase
          .from('fragments')
          .select('id')
          .in('id', fragmentIds)
          .eq('is_featured', true);

        if (error || !data) return;
        setFeaturedFragmentIds(new Set(data.map((item) => item.id).filter(Boolean)));
      } catch (error) {
        console.error('[Nostalgia] sync featured fragments failed:', error);
      }
    };

    fetchFeaturedFragments();
  }, [hasHydrated, fragmentIdKey]);

  const buckets = useMemo(() => {
    const sorted = [...localFragments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const bucketMap = new Map<string, Fragment[]>();
    const order: string[] = [];

    sorted.forEach((fragment) => {
      const label = getFuzzyTime(fragment.created_at);
      if (!bucketMap.has(label)) {
        bucketMap.set(label, []);
        order.push(label);
      }
      bucketMap.get(label)!.push(fragment);
    });

    return order.map((label) => ({ label, items: bucketMap.get(label)! }));
  }, [localFragments]);

  if (!hasHydrated) return <div className="fixed inset-0 bg-[#080808]" />;

  return (
    // 🟢 绝对视口弹性架构：fixed inset-0 阻断一切外部布局污染
    <main className="fixed inset-0 z-50 flex flex-col items-center bg-[#080808] text-zinc-200 selection:bg-zinc-800 selection:text-zinc-100">
      
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.025),transparent_40%)]" />

      {/* 悬浮顶部导航栏 */}
      <header className="absolute left-0 right-0 top-0 z-30 flex h-24 items-center justify-center bg-gradient-to-b from-[#080808] via-[#080808]/80 to-transparent">
        <div className="flex w-full max-w-[430px] items-center justify-between px-8">
          <Link href="/v2" className="text-[11px] tracking-[0.18em] text-zinc-600 transition-colors duration-500 hover:text-zinc-300 outline-none">
            返回
          </Link>
          <span className="text-[10px] tracking-[0.24em] text-zinc-700 font-mono">TIMELINE</span>
        </div>
      </header>

      {/* 核心滚动内容区 */}
      <div className="relative z-10 flex w-full max-w-[430px] flex-1 flex-col overflow-y-auto px-6 pb-32 pt-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        
        {/* 🟢 新增：照照镜子入口 (仅在碎片>=2时出现) */}
        {localFragments.length >= 2 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="mb-14 flex w-full justify-center"
          >
            <Link 
              href="/v2/mirror" 
              className="group relative flex items-center justify-center overflow-hidden border border-zinc-800/80 bg-zinc-900/30 px-6 py-3 transition-colors hover:border-zinc-600 hover:bg-zinc-900/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="text-[11px] tracking-[0.2em] text-zinc-400 group-hover:text-zinc-200 transition-colors">
                [ 照照镜子：与过去的自己共鸣 ]
              </span>
            </Link>
          </motion.div>
        )}

        {buckets.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[12px] tracking-[0.2em] text-zinc-700">抽屉里空空如也。</p>
          </div>
        ) : (
          <div className="flex flex-col gap-14">
            {buckets.map((bucket) => (
              <div key={bucket.label} className="flex flex-col items-center">
                
                <span className="mb-10 text-[11px] tracking-[0.2em] text-zinc-600 font-mono">
                  [ {bucket.label} ]
                </span>

                <div className="flex w-full flex-col gap-8">
                  {bucket.items.map((fragment, fIndex) => (
                    <motion.article
                      key={fragment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: fIndex * 0.05 }}
                      className="group relative flex flex-col bg-zinc-950/30 px-7 py-8 border border-zinc-900/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-colors hover:border-zinc-800/80"
                    >
                      <div className="absolute right-6 top-6 text-zinc-700">
                        {fragment.visibility === 'public' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                      </div>

                      <h2 className="text-[17px] font-light tracking-[0.08em] text-zinc-200 pr-8">
                        {fragment.title}
                      </h2>
                      
                      <p className="mt-6 whitespace-pre-wrap text-[14px] font-light leading-[1.8] tracking-[0.06em] text-zinc-400">
                        {fragment.original_content}
                      </p>

                      {fragment.narration_content && (
                        <div className="mt-8 border-l border-zinc-800/80 pl-4">
                          <p className="text-[12px] font-light leading-7 tracking-[0.06em] text-zinc-500 italic">
                            {fragment.narration_content}
                          </p>
                        </div>
                      )}

                      {fragment.shopkeeper_comment && (
                        <div className="mt-8 rounded-sm bg-zinc-900/40 px-5 py-4 border border-zinc-800/50">
                          <p className="text-[10px] tracking-[0.15em] text-zinc-600 font-mono mb-3">SHOPKEEPER</p>
                          <p className="text-[12px] font-light leading-relaxed tracking-[0.06em] text-zinc-400">
                            {fragment.shopkeeper_comment}
                          </p>
                        </div>
                      )}

                      <div className="mt-8 flex items-center justify-between border-t border-zinc-900/50 pt-5">
                        <span className="text-[9px] tracking-[0.15em] text-zinc-700 font-mono">
                          {new Date(fragment.created_at).toLocaleDateString().replace(/\//g, '.')}
                        </span>
                        {featuredFragmentIds.has(fragment.id) && (
                          <span className="max-w-[11rem] text-right text-[9px] leading-4 tracking-[0.12em] text-zinc-700">
                            今天有人在这块碎片前安静地站了一会儿。
                          </span>
                        )}
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="mt-12 text-center text-[10px] tracking-[0.4em] text-zinc-800 font-mono opacity-60">
              END HERE
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
