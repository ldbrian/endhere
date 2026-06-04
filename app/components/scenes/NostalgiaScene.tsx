'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { Receipt } from '../ui/Receipt'; 

export default function NostalgiaScene() {
  const setScene = useSpaceStore((state) => state.setScene);
  const entries = useShelterStore((state) => state.entries);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      audioRef.current = new Audio('/drawer-open.mp3');
      audioRef.current.volume = 0.15;
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.warn('Audio layer skipped.');
    }
  }, []);

  const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      className="relative w-full h-screen bg-black overflow-hidden select-none text-zinc-500"
    >
      {/* 顶部纯黑渐变遮罩 */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black via-black/90 to-transparent z-20 pointer-events-none" />
      
      {/* 固定返回按钮 */}
      <button
        onClick={() => setScene('entrance')}
        className="absolute top-12 left-6 md:left-12 tracking-[0.2em] text-[13px] text-zinc-600 opacity-60 hover:opacity-100 hover:text-zinc-400 transition-all duration-700 outline-none z-30 cursor-pointer block"
      >
        [ 退回门厅 ]
      </button>

      {sortedEntries.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center relative z-10">
          <p className="text-zinc-600 text-sm tracking-[0.2em] font-mono font-light">
            [ 抽屉是空的。角落里有一只知了的空壳。 ]
          </p>
        </div>
      ) : (
        <div className="absolute inset-0 overflow-y-auto z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col items-center">
          <div className="w-full max-w-[400px] flex flex-col items-center gap-6 pt-0 pb-40 px-5">
            
            {/* 顶部真实占位，确保第一张小票完全在渐变遮罩以下 */}
            <div style={{ height: "180px", flexShrink: 0 }} />

            {sortedEntries.map((entry, index) => (
              <motion.div 
                key={entry.id} 
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 + index * 0.1, ease: 'easeOut' }}
                className="w-full flex justify-center"
              >
                <Receipt 
                    type="memo" 
                    status="normal" 
                    data={{
                        receiptId: entry.receiptId,
                        timestamp: entry.timestamp,
                        user_message: entry.content,
                        // 解耦分流：如果是店长模式，没有 AI 回复；反之则填入 AI 数据
                        ai_name: entry.persona !== 'Manager' ? entry.persona : undefined,
                        ai_reply: entry.persona !== 'Manager' ? (entry.punchline || entry.rawResponse) : undefined,
                        // 店长的真实回复直接映射到新的 manager_reply 字段
                        manager_reply: entry.manager_message
                    }} 
                    />
              </motion.div>
            ))}
            
            <div className="mt-8 text-zinc-800 text-xs tracking-widest font-mono text-center select-none w-full">
              - 到底了 -
            </div>
            
          </div>
        </div>
      )}
    </motion.div>
  );
}