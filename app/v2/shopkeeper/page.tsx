'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';

type ShopkeeperLog = {
  id: string;
  content: string;
  created_at: string;
};

export default function V2ShopkeeperPage() {
  const [logs, setLogs] = useState<ShopkeeperLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // 胶囊点击后的二级页：读取店长历史动态记录
        const { data, error } = await supabase
          .from('shopkeeper_logs')
          .select('id, content, created_at')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setLogs(data as ShopkeeperLog[]);
        }
      } catch (e) {
        console.error('[ShopkeeperPage] fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center bg-[#050505] text-zinc-200 selection:bg-zinc-800 selection:text-zinc-100 font-mono">
      {/* 极暗背景光晕 */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.02),transparent_40%)]" />

      {/* 悬浮顶部导航栏 */}
      <header className="absolute left-0 right-0 top-0 z-30 flex h-24 items-center justify-center bg-gradient-to-b from-[#050505] via-[#050505]/80 to-transparent">
        <div className="flex w-full max-w-[430px] items-center justify-between px-8">
          <Link href="/v2" className="text-[11px] tracking-[0.18em] text-zinc-600 transition-colors duration-500 hover:text-zinc-300 outline-none">
            返回
          </Link>
          <span className="text-[10px] tracking-[0.24em] text-zinc-700">SHOPKEEPER LOGS</span>
        </div>
      </header>

      {/* 核心滚动内容区 */}
      <div className="relative z-10 flex w-full max-w-[430px] flex-1 flex-col overflow-y-auto px-8 pb-32 pt-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        
        <div className="mb-14 flex flex-col items-center text-center">
          <h1 className="text-[15px] font-light tracking-[0.2em] text-zinc-300 mb-4">店长动态</h1>
          <p className="text-[11px] leading-relaxed tracking-[0.15em] text-zinc-600">
            这里存放着店长留下的、不干预任何人的世界碎片。
          </p>
        </div>

        {loading ? (
          <p className="text-center text-[11px] tracking-widest text-zinc-800 mt-10">...</p>
        ) : logs.length === 0 ? (
          <p className="text-center text-[11px] tracking-widest text-zinc-700 mt-10">
            还没有任何记录。
          </p>
        ) : (
          <div className="flex flex-col gap-12">
            {logs.map((log, index) => (
              <motion.article
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05, ease: 'easeOut' }}
                className="flex flex-col border-t border-zinc-900/60 pt-8"
              >
                <span className="mb-6 text-[10px] tracking-[0.25em] text-zinc-600 font-mono">
                  {new Date(log.created_at).toLocaleDateString().replace(/\//g, '.')}
                </span>
                <p className="whitespace-pre-wrap text-[13px] font-light leading-[2] tracking-[0.1em] text-zinc-400">
                  {log.content}
                </p>
              </motion.article>
            ))}
            
            <div className="mt-12 text-center text-[10px] tracking-[0.3em] text-zinc-800 font-mono opacity-60">
              END HERE
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
