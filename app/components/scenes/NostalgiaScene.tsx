'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { Receipt } from '../ui/Receipt'; 
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../hooks/useLanguage';
import type { RuminationContext } from '../../store/useSpaceStore';

export default function NostalgiaScene() {
  const setScene = useSpaceStore((state) => state.setScene);
  const setIncineratorTarget = useSpaceStore((state) => state.setIncineratorTarget);
  const setRuminationContext = useSpaceStore((state) => state.setRuminationContext);
  
  const entries = useShelterStore((state) => state.entries);
  const updateEntry = useShelterStore((state) => state.updateEntry); 
  const addEntry = useShelterStore((state) => state.addEntry);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lang = useLanguage();

  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    try {
      audioRef.current = new Audio('/drawer-open.mp3');
      audioRef.current.volume = 0.15;
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.warn('Audio layer skipped.');
    }
  }, []);

  useEffect(() => {
      const syncManagerReplies = async () => {
        try {
          const { data, error } = await supabase
            .from('manager_mailbox')
            .select('receipt_id, manager_reply')
            .not('manager_reply', 'is', null);
  
          if (error) throw error;
  
          if (data && data.length > 0) {
            data.forEach((dbRecord) => {
              const localEntry = entries.find(e => e.receiptId === dbRecord.receipt_id);
              if (localEntry) {
                if (localEntry.manager_message !== dbRecord.manager_reply) {
                  updateEntry(localEntry.id, {
                    manager_message: dbRecord.manager_reply
                  });
                }
              }
            });
          }
        } catch (err) {
          console.error('同步店长批注失败:', err);
        }
      };
  
      if (entries.length > 0) {
        syncManagerReplies();
      }
    }, [entries.length, updateEntry]);

  const handleAddVirtualItem = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newItemText.trim()) {
      addEntry({
        id: crypto.randomUUID(), 
        receiptId: `V-${Date.now()}`,
        timestamp: Date.now(),
        content: newItemText.trim(),
        persona: 'User',
        type: 'virtual_item',
        status: 'normal'
      });
      setNewItemText('');
    }
  };

  const handleTransferToIncinerator = (entry: any) => {
    setIncineratorTarget(entry);
    setScene('incinerator');
  };

  const handleRuminate = (entry: any) => {
    const ctx: RuminationContext = {
      entryId: entry.id,
      receiptId: entry.receiptId,
      originalContent: entry.content,
      originalTimestamp: entry.timestamp,
      mind_track: entry.mind_track || entry.punchline || entry.cleanText || '',
      persona: entry.persona && entry.persona !== 'Manager' ? entry.persona : 'Ash',
    };
    setRuminationContext(ctx);
    setScene('speaking');
  };

  const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      className="relative w-full h-screen bg-black overflow-hidden select-none text-zinc-500"
    >
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black via-black/90 to-transparent z-20 pointer-events-none" />
      
      <button
        onClick={() => setScene('entrance')}
        className="absolute top-12 left-6 md:left-12 tracking-[0.2em] text-[13px] text-zinc-600 opacity-60 hover:opacity-100 hover:text-zinc-400 transition-all duration-700 outline-none z-30 cursor-pointer block"
      >
        {lang.HOME.back}
      </button>

      <div className="absolute inset-0 overflow-y-auto z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col items-center">
        <div className="w-full max-w-[400px] flex flex-col items-center gap-10 pt-0 pb-40 px-5">
          
          <div style={{ height: "140px", flexShrink: 0 }} />

          <div className="w-full px-2 mb-4 mt-4">
            <input 
              type="text" 
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={handleAddVirtualItem}
              className="w-full bg-transparent border-b border-zinc-800 text-zinc-400 text-[12px] tracking-[0.2em] text-center pb-2 outline-none placeholder:text-zinc-700/50 transition-colors focus:border-zinc-500"
              placeholder="[ 放入一件旧物... 按回车存放 ]"
            />
          </div>

          {sortedEntries.length === 0 ? (
            <p className="text-zinc-600 text-sm tracking-[0.2em] font-mono font-light mt-10">
              {lang.NOSTALGIA.empty}
            </p>
          ) : (
            sortedEntries.map((entry, index) => (
              <motion.div 
                key={entry.id} 
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: index * 0.1, ease: 'easeOut' }}
                className="w-full flex flex-col items-center gap-3" 
              >
                {/* 虚拟旧物 (黑卡) */}
                {entry.type === 'virtual_item' ? (
                  <div className="w-full bg-white/[0.02] border border-zinc-800 rounded-none p-6 text-left flex flex-col">
                    <p className="text-zinc-400 text-[13px] tracking-widest font-light leading-relaxed">
                      {entry.content}
                    </p>
                    {/* CDO 规范：内嵌底部常驻操作栏 */}
                    <div className="mt-6 flex justify-between items-center w-full">
                      <span className="text-zinc-700 text-[10px] tracking-widest font-mono">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <button 
                        onClick={() => handleTransferToIncinerator(entry)}
                        className="text-[10px] text-zinc-600 hover:text-red-900/80 tracking-widest transition-colors outline-none"
                      >
                        [ 移交销毁 ]
                      </button>
                    </div>
                  </div>
                ) : (
                  // 情绪小票 (Receipt)
                  <div className="w-full flex flex-col items-end gap-2">
                    <div className="w-full flex justify-center">
                      <Receipt 
                        type="memo" 
                        status="normal"
                        lang={lang}
                        data={{
                            receiptId: entry.receiptId,
                            timestamp: entry.timestamp,
                            user_message: entry.content,
                            ai_name: entry.persona !== 'Manager' ? entry.persona : undefined,
                            ai_reply: entry.persona !== 'Manager' ? (entry.punchline || entry.rawResponse) : undefined,
                            manager_reply: entry.manager_message
                        }} 
                      />
                    </div>

                    {/* Patch 补丁日志：每次反刍追加，绝不覆盖原始记录 */}
                    {entry.patches && entry.patches.length > 0 && (
                      <div className="w-full flex flex-col gap-0">
                        {entry.patches.map((patch: any, pi: number) => (
                          <div key={pi} className="w-full border-t border-dashed border-zinc-700/60 pt-4 pb-4 flex flex-col gap-3 px-1">
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] text-zinc-600 tracking-[0.2em] font-mono opacity-70">
                                {patch.timestamp}
                              </span>
                              <span className="text-[9px] text-zinc-700 tracking-[0.1em]">/ 又想起来了</span>
                            </div>
                            <p className="text-[12px] text-zinc-500 tracking-wider leading-relaxed whitespace-pre-wrap opacity-80">
                              {patch.content}
                            </p>
                            {patch.ai_reply && (
                              <p className="text-[11px] text-zinc-600 tracking-wider leading-relaxed whitespace-pre-wrap opacity-70 border-l border-zinc-800 pl-3">
                                {patch.ai_reply}
                              </p>
                            )}
                            {patch.mind_track && (
                              <p className="text-[10px] text-zinc-700 tracking-[0.15em] italic opacity-60">
                                摘要：{patch.mind_track}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 常驻操作栏 */}
                    <div className="flex gap-6 pr-4">
                      <button 
                        onClick={() => handleRuminate(entry)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 tracking-widest transition-colors duration-500 outline-none"
                      >
                        [ 我想再谈谈这件事 ]
                      </button>
                      <button 
                        onClick={() => handleTransferToIncinerator(entry)}
                        className="text-[10px] text-zinc-600 hover:text-red-900/80 tracking-widest transition-colors outline-none"
                      >
                        [ 移交销毁 ]
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
          
          {sortedEntries.length > 0 && (
            <div className="mt-8 text-zinc-800 text-xs tracking-widest font-mono text-center select-none w-full">
              {lang.NOSTALGIA.end}
            </div>
          )}
          
        </div>
      </div>
    </motion.div>
  );
}