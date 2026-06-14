'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { supabase } from '../../lib/supabase';

interface LogEntry {
  id: string;
  content: string;
  created_at: string;
}

// 把时间戳格式化成 "2026.06.14" 风格
function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export default function ShopkeeperScene() {
  const setScene = useSpaceStore((state) => state.setScene);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('shopkeeper_logs')
          .select('id, content, created_at')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setLogs(data);
        }
      } catch (e) {
        console.error('[ShopkeeperScene] fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="relative w-full h-[100dvh] bg-[#030303] overflow-hidden select-none font-mono text-zinc-500">

      {/* 顶部渐变遮罩 */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#030303] via-[#030303]/90 to-transparent z-20 pointer-events-none" />

      {/* 返回按钮 */}
      <button
        onClick={() => setScene('entrance')}
        className="absolute top-10 left-8 tracking-[0.2em] text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors duration-500 outline-none z-30 cursor-pointer"
      >
        [ 返回门厅 ]
      </button>

      {/* 滚动内容区 */}
      <div
        className="absolute top-20 inset-0 overflow-y-auto z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col items-center"
        style={{ paddingLeft: '32px', paddingRight: '32px' }}
      >
        <div className="w-full flex flex-col pt-32 pb-24" style={{ maxWidth: '420px' }}>

          {/* 页面标题 */}
          <div className="mb-12">
            <h1 className="text-zinc-300 text-[15px] tracking-[0.2em] font-light mb-3">
              店长留下的东西
            </h1>
            <p className="text-zinc-700 text-[11px] tracking-[0.15em] leading-relaxed">
              这里放着店长曾经留下的一些痕迹。
            </p>
          </div>

          {/* 内容列表 */}
          {loading ? (
            <p className="text-zinc-800 text-[11px] tracking-widest mt-10">...</p>
          ) : logs.length === 0 ? (
            <p className="text-zinc-700 text-[11px] tracking-widest mt-10">
              还没有任何记录。
            </p>
          ) : (
            <div className="flex flex-col">
              {logs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.04, ease: 'easeOut' }}
                  className="flex flex-col py-8 border-b border-zinc-900"
                >
                  {/* 日期 */}
                  <span className="text-zinc-700 text-[10px] tracking-[0.25em] mb-4 font-mono">
                    {formatDate(log.created_at)}
                  </span>

                  {/* 正文：完整显示，自动换行，不截断 */}
                  <p className="text-zinc-400 text-[13px] tracking-wider leading-[1.9] font-light whitespace-pre-wrap">
                    {log.content}
                  </p>
                </motion.div>
              ))}

              {/* 列表底部 */}
              <div className="mt-12 text-zinc-800 text-[10px] tracking-widest font-mono text-center">
                — 以上是全部记录 —
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}