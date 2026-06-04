'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { supabase } from '../../lib/supabase';
import { Receipt } from '../ui/Receipt';

const PERSONAS = [
  { id: 'Ash', label: 'Ash (调酒师)' },
  { id: 'Rin', label: 'Rin (倾听者)' },
  { id: 'Child', label: '8岁的自己' },
  { id: 'Manager', label: '店长 (不经AI)' }
];

// 核心清洗引擎：剥离大模型污染格式，提取纯对话与命运物品，并铲除所有残留的 XML 标签
const parseAiResponse = (rawText: string) => {
  const itemRegex = /ID:\s*(\w+)\s*NAME:\s*([^\sDESC:]+)\s*DESC:\s*(.+)/;
  const match = rawText.match(itemRegex);
  
  let clean = rawText;
  let item = null;

  if (match) {
    clean = rawText.replace(itemRegex, '').trim();
    item = { id: match[1], name: match[2], desc: match[3] };
  }
  
  // 兜底清洗：粉碎大模型可能发出的任何 <解析> 或其他 XML 噪音
  clean = clean.replace(/<[^>]+>/g, '').trim();

  return { cleanText: clean, item };
};

export default function SpeakingScene() {
  const setScene = useSpaceStore((state) => state.setScene);
  const addEntry = useShelterStore((state) => state.addEntry);
  
  const [text, setText] = useState('');
  const [persona, setPersona] = useState('Ash');
  
  // 核心：三段式生命周期状态机
  const [step, setStep] = useState<'typing' | 'reading' | 'receipt'>('typing');
  // 辅助：流式网络状态
  const [streamState, setStreamState] = useState<'idle' | 'loading' | 'streaming' | 'done'>('idle');
  
  // 动态数据装载区（完全解耦物品与纯文本）
  const [cleanAiText, setCleanAiText] = useState('');
  const [aiItem, setAiItem] = useState<{id: string, name: string, desc: string} | null>(null);
  const [generatedReceipt, setGeneratedReceipt] = useState<any | null>(null);

  const finalReceiptIdRef = useRef('');

  const handleSubmit = async () => {
    if (!text.trim() || streamState !== 'idle') return;
    
    finalReceiptIdRef.current = 'EH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    setStep('reading');
    setStreamState('loading');

    // ==========================================
    // 分支 A：店长模式 (无 AI 介入)
    // ==========================================
    if (persona === 'Manager') {
      const mockEntry = {
        id: Date.now(),
        receiptId: finalReceiptIdRef.current,
        content: text,
        persona: 'Manager',
        status: '待处理',
        timestamp: Date.now(),
        createdAt: new Date().toISOString()
      };
      
      addEntry(mockEntry);
      
      // 统一写往唯一的实体表 manager_mailbox
      try {
        const { error } = await supabase
          .from('manager_mailbox')
          .insert([{ 
            receipt_id: mockEntry.receiptId, 
            user_message: text,
            created_date: new Date().toISOString().split('T')[0] 
          }]);
        if (error) throw error;
      } catch (e) {
        console.error('[店长模式] 投递至 manager_mailbox 失败:', JSON.stringify(e));
      }
      
      setGeneratedReceipt(mockEntry);
      setStreamState('done');
      return;
    }

    // ==========================================
    // 分支 B：AI 流式反馈模式 
    // ==========================================
    try {
      setStreamState('streaming');
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: text, 
          emotion: 'complex',
          persona, 
          clientHour: new Date().getHours() 
        }),
      });

      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const parsed = parseAiResponse(buffer);
        setCleanAiText(parsed.cleanText);
        if (parsed.item) setAiItem(parsed.item);
      }

      const finalParsed = parseAiResponse(buffer);
      const localEntry = {
        id: Date.now(),
        receiptId: finalReceiptIdRef.current,
        content: text,
        persona: persona,
        cleanText: finalParsed.cleanText, 
        item: finalParsed.item,           
        rawResponse: buffer,
        timestamp: Date.now(),
        status: '待处理',
        createdAt: new Date().toISOString()
      };
      
      addEntry(localEntry);
      
      // 修复 AI 数据的静默失败，统一写入 manager_mailbox
      try {
        const { error } = await supabase
          .from('manager_mailbox')
          .insert([{ 
            receipt_id: finalReceiptIdRef.current, 
            user_message: text,
            // 将纯净的 AI 文本存入数据库，供店长后台查阅
            ai_response: finalParsed.cleanText,
            // 核心修复：填补非空约束
            created_date: new Date().toISOString().split('T')[0]
          }]);
        if (error) throw error;
      } catch (e) {
        console.error('[AI模式] 投递至 manager_mailbox 失败:', JSON.stringify(e));
      }

      setGeneratedReceipt(localEntry);
      setStreamState('done');

    } catch (error) {
      console.error('AI Stream failed:', error);
      setCleanAiText('信号中断了。店长在后面修基站，早点休息吧。');
      setStreamState('done');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      className="relative w-full h-full flex flex-col items-center justify-center bg-transparent overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      
      {/* 全局退路：只在 typing 阶段允许退出 */}
      {step === 'typing' && (
        <button
          onClick={() => setScene('entrance')}
          className="absolute top-12 left-6 md:left-12 tracking-[0.2em] text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors duration-700 outline-none block z-30"
        >
          [ 退回门厅 ]
        </button>
      )}

      <div className="relative w-full max-w-2xl px-6 flex flex-col items-center py-20 min-h-screen justify-center">
        
        <AnimatePresence mode="wait">
          
          {/* =========================================================
              阶段 1：打字输入期 (Typing)
              ========================================================= */}
          {step === 'typing' && (
            <motion.div 
              key="typing-stage" 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 1 }}
              className="w-full"
            >
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="在这里写下吧..."
                className="w-full h-64 bg-transparent outline-none resize-none font-mono text-zinc-400 caret-zinc-500 text-base md:text-lg tracking-wider leading-relaxed placeholder:text-zinc-700"
              />

              {text.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1 }}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-4 border-t border-zinc-800/50"
                >
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono tracking-[0.1em]">
                    <span className="text-zinc-700">想留给:</span>
                    {PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPersona(p.id)}
                        className={`transition-colors duration-500 outline-none ${
                          persona === p.id ? 'text-zinc-400' : 'text-zinc-700 hover:text-zinc-500'
                        }`}
                      >
                        {persona === p.id ? `[ ${p.label} ]` : p.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleSubmit}
                    className="tracking-[0.2em] text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-500 outline-none whitespace-nowrap"
                  >
                    [ 压入收银台 ]
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* =========================================================
              阶段 2：阅读静置期 (Reading)
              ========================================================= */}
          {step === 'reading' && (
            <motion.div 
              key="reading-stage" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 1 }}
              className="w-full flex flex-col items-center text-center gap-8"
            >
              {streamState === 'loading' && (
                <p className="text-zinc-600 tracking-[0.2em] text-sm animate-pulse">
                  {persona === 'Manager' ? '正在压入抽屉...' : `${persona} 正在听...`}
                </p>
              )}

              {/* 内容展示区：彻底解耦纯文本与命运物品 */}
              {(streamState === 'streaming' || streamState === 'done') && (
                <div className="space-y-12 w-full max-w-xl mx-auto">
                  {persona === 'Manager' ? (
                    <p className="text-zinc-300 text-sm md:text-base tracking-widest leading-loose font-light whitespace-pre-wrap text-left">
                      {text}
                    </p>
                  ) : (
                    <div className="flex flex-col w-full">
                      
                      {/* 上方：纯净的对话文本 */}
                      <p className="text-zinc-300 text-sm md:text-base tracking-widest leading-loose font-light text-left whitespace-pre-wrap">
                        {cleanAiText}
                      </p>
                      
                      {/* 下方：命运物品的幽灵态物理渲染 */}
                      {aiItem && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8 }}
                          className="mt-12 border border-zinc-800/50 bg-zinc-900/20 p-4 rounded-sm w-fit mx-auto flex flex-col items-center gap-2"
                        >
                          <div className="text-zinc-400 text-sm tracking-widest">
                            [ 吧台上多了一样东西：{aiItem.name} ]
                          </div>
                          <div className="text-zinc-600 text-xs tracking-wider">
                            {aiItem.desc}
                          </div>
                        </motion.div>
                      )}

                    </div>
                  )}
                </div>
              )}

              {/* 沉浸后的主动触发：延迟 1.5 秒淡入 */}
              {streamState === 'done' && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5, duration: 1 }}
                  onClick={() => setStep('receipt')}
                  className="mt-16 tracking-[0.3em] text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-700 outline-none block border border-zinc-800/50 px-6 py-3 rounded-sm bg-zinc-950/30"
                >
                  [ 打印小票 ]
                </motion.button>
              )}
            </motion.div>
          )}

          {/* =========================================================
              阶段 3：小票结算期 (Receipt)
              ========================================================= */}
          {step === 'receipt' && generatedReceipt && (
            <motion.div
              key="receipt-stage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: 'easeInOut' }}
              className="w-full flex flex-col items-center"
            >
              <div className="w-full max-w-[400px] mx-auto">
                <Receipt 
                    type="memo"
                    status="normal"
                    data={{
                        receiptId: generatedReceipt.receiptId,
                        timestamp: generatedReceipt.timestamp,
                        user_message: generatedReceipt.content,
                        ai_name: generatedReceipt.persona !== 'Manager' ? generatedReceipt.persona : undefined,
                        // 彻底阻断污染：仅传入清洗后的纯文本
                        ai_reply: generatedReceipt.persona !== 'Manager' ? generatedReceipt.cleanText : undefined,
                        manager_reply: null 
                    }}
                />
              </div>

              {/* 物理退场按钮 */}
              <button
                onClick={() => setScene('entrance')}
                className="mt-16 text-zinc-600 hover:text-zinc-400 text-xs tracking-[0.3em] uppercase transition-colors duration-700 outline-none block"
              >
                [ 留在抽屉并离开 ]
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}