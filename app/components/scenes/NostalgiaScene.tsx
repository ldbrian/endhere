'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { Receipt } from '../ui/Receipt';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../hooks/useLanguage';
import type { RuminationContext } from '../../store/useSpaceStore';

// 模糊时间桶
const getFuzzyTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const hours = diff / (1000 * 60 * 60);
  const days = diff / (1000 * 60 * 60 * 24);
  if (hours < 1) return '刚刚';
  if (hours < 24) return '今天';
  if (days < 2) return '昨天';
  if (days < 7) return '几天前';
  if (days < 30) return '几周前';
  return '很久以前';
};

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

  const submitVirtualItem = () => {
    if (!newItemText.trim()) return;
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
  };

  const handleAddVirtualItem = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submitVirtualItem();
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

  // 分组到时间桶（Map 合并同标签，避免重复 key）
  const bucketMap = new Map<string, typeof sortedEntries>();
  const bucketOrder: string[] = [];
  sortedEntries.forEach((entry) => {
    const label = getFuzzyTime(entry.timestamp);
    if (!bucketMap.has(label)) {
      bucketMap.set(label, []);
      bucketOrder.push(label);
    }
    bucketMap.get(label)!.push(entry);
  });
  const buckets = bucketOrder.map((label) => ({ label, items: bucketMap.get(label)! }));

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
        className="absolute top-10 left-8 tracking-[0.2em] text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors duration-500 outline-none z-30 cursor-pointer"
      >
        {lang.HOME.back}
      </button>

      <div className="absolute inset-0 overflow-y-auto z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col items-center" style={{ paddingLeft: '32px', paddingRight: '32px' }}>
        <div className="w-full max-w-[400px] flex flex-col items-center pb-40">

          <div style={{ height: "140px", flexShrink: 0 }} />

          <div className="w-full px-2 mb-10 flex items-center gap-3 border-b border-zinc-800 focus-within:border-zinc-500 transition-colors">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={handleAddVirtualItem}
              className="flex-1 bg-transparent text-zinc-400 text-[12px] tracking-[0.2em] text-center pb-2 outline-none placeholder:text-zinc-700/50"
              placeholder="[ 放入一件旧物... ]"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={submitVirtualItem}
              disabled={!newItemText.trim()}
              className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 text-[11px] tracking-widest font-mono pb-2 outline-none transition-colors shrink-0"
            >
              [ 存放 ]
            </button>
          </div>

          {sortedEntries.length === 0 ? (
            <p className="text-zinc-600 text-sm tracking-[0.2em] font-mono font-light mt-10">
              {lang.NOSTALGIA.empty}
            </p>
          ) : (
            <div className="w-full flex flex-col">
              {buckets.map((bucket, bi) => (
                <div key={`${bucket.label}-${bi}`} className="w-full flex flex-col items-center">
                  {/* 时间桶标头 */}
                  <div className="w-full flex justify-center my-6 first:mt-0">
                    <span className="text-zinc-600 text-[12px] tracking-widest font-mono">
                      [ {bucket.label} ]
                    </span>
                  </div>

                  <div className="w-full flex flex-col items-center gap-5">
                    {bucket.items.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
                        className="w-full flex flex-col items-center gap-3"
                      >
                        {/* 1. 虚拟旧物：物件感卡片，左侧厚重标记条 */}
                        {entry.type === 'virtual_item' && (
                          <div
                            className="w-full flex flex-col relative"
                            style={{
                              boxSizing: 'border-box',
                              width: '100%',
                              minWidth: '100%',
                              padding: '24px',
                              paddingLeft: '28px',
                              backgroundColor: 'rgba(0,0,0,0.35)',
                              borderTop: '1px solid rgba(255,255,255,0.05)',
                              borderRight: '1px solid rgba(255,255,255,0.05)',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              borderLeft: '3px solid rgba(255,255,255,0.12)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 30px -18px rgba(0,0,0,0.8)',
                            }}
                          >
                            <span
                              className="text-zinc-700 font-mono"
                              style={{ fontSize: '9px', letterSpacing: '0.3em', marginBottom: '14px' }}
                            >
                              旧物
                            </span>
                            <p
                              className="text-zinc-400 text-[13px] tracking-widest font-light"
                              style={{ lineHeight: '1.9', marginBottom: '24px' }}
                            >
                              {entry.content}
                            </p>
                            <div className="flex justify-between items-center w-full">
                              <span className="text-zinc-700 text-[10px] tracking-widest font-mono">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 2. 生活碎片 (普通卡片，有质感) */}
                        {entry.type === 'life_fragment' && (
                          <div
                            className="w-full flex flex-col rounded-sm relative"
                            style={{
                              boxSizing: 'border-box',
                              width: '100%',
                              minWidth: '100%',
                              padding: '24px',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 30px -15px rgba(0,0,0,0.7)',
                            }}
                          >
                            <p
                              className="text-zinc-300 text-[13px] tracking-wider font-light"
                              style={{ lineHeight: '1.9', marginBottom: '24px' }}
                            >
                              {entry.content}
                            </p>
                            <div className="flex justify-between items-center w-full">
                              <span className="text-zinc-600 text-[10px] tracking-widest font-mono">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 3. 情绪小票 (Receipt) */}
                        {(entry.type === 'receipt' || !entry.type) && entry.status !== 'incinerated' && (
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

                            {/* Patch 补丁日志 */}
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
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sortedEntries.length > 0 && (
            <div className="mt-12 text-zinc-800 text-xs tracking-widest font-mono text-center select-none w-full">
              {lang.NOSTALGIA.end}
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
}