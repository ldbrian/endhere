'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { supabase } from '../../lib/supabase';
import { Receipt } from '../ui/Receipt';
import { track } from '../../lib/track';
import { useWorldSummary } from '../../hooks/useWorldSummary';
import { useTraces } from '../../hooks/useTraces';
import { useLanguage } from '../../hooks/useLanguage';

const PERSONAS = [
  { id: 'Ash', label: 'Ash (调酒师)' },
  { id: 'Rin', label: 'Rin (倾听者)' },
  { id: 'Child', label: '8岁的自己' },
  { id: 'Manager', label: '店长 (不经AI)' }
];

const EMOTION_ANCHORS = ['感到疲惫', '无法平静', '觉得一切毫无意义', '只是想骂人'];

const parseAiResponse = (rawText: string) => {
  const mindMatch = rawText.match(/<mind>([\s\S]*?)<\/mind>/);
  const mind_track = mindMatch ? mindMatch[1].trim() : null;

  const itemRegex = /ID:\s*(\w+)\s*NAME:\s*([^\sDESC:]+)\s*DESC:\s*(.+)/;
  const match = rawText.match(itemRegex);
  
  let clean = rawText;
  let item = null;

  if (match) {
    clean = rawText.replace(itemRegex, '').trim();
    item = { id: match[1], name: match[2], desc: match[3] };
  }
  
  clean = clean.replace(/<[^>]+>/g, '').trim();
  return { cleanText: clean, item, mind_track };
};

export default function SpeakingScene() {
  const setScene = useSpaceStore((state) => state.setScene);
  const addEntry = useShelterStore((state) => state.addEntry);
  const addPatch = useShelterStore((state) => state.addPatch);

  const ruminationContext = useShelterStore((state) => state.ruminationContext);
  const setRuminationContext = useShelterStore((state) => state.setRuminationContext);

  const lang = useLanguage();
  const envText = useWorldSummary();
  const traces = useTraces();
  
  // 🟢 核心多轮状态机
  const [history, setHistory] = useState<{id: string, role: 'user'|'assistant', content: string}[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [isSessionEnding, setIsSessionEnding] = useState(false);
  const [step, setStep] = useState<'chat' | 'receipt'>('chat');
  
  const [text, setText] = useState('');
  const [persona, setPersona] = useState('Ash');
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  
  const [streamState, setStreamState] = useState<'idle' | 'loading' | 'streaming' | 'done'>('idle');
  const [cleanAiText, setCleanAiText] = useState('');
  const [aiItem, setAiItem] = useState<{id: string, name: string, desc: string} | null>(null);
  const [generatedReceipt, setGeneratedReceipt] = useState<any | null>(null);

  const finalReceiptIdRef = useRef('');

  // 🟢 统一的单轮引擎
  const runTurn = async (userText: string, isEnding: boolean, historyForApi: any[]) => {
    if (!finalReceiptIdRef.current) {
      finalReceiptIdRef.current = 'EH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    setStreamState('loading');
    setCleanAiText('');

    try {
      setStreamState('streaming');
      const tracesContext = traces.length > 0 ? traces.map(t => `${t.name}(${t.desc})`).join('；') : '无特别痕迹';
      
      const anchorContext = activeAnchor ? `[系统：用户在当前选择了隐藏的情绪锚点：“${activeAnchor}”。]\n` : '';
      const ruminCtxStr = ruminationContext
        ? `[系统：用户目前正在反刍一张过去的记录。他过去的核心情绪是："${ruminationContext.mind_track || ruminationContext.originalContent}"。请基于此倾听他现在的感受。]\n`
        : '';
      const smuggledContent = `[系统环境感知：当前世界动态是"${envText || '安静'}。物理痕迹有：${tracesContext}。规则：请自然反映环境细节，切忌生硬播报。]\n\n${ruminCtxStr}${anchorContext}用户说：${userText}`;

      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: smuggledContent,
          emotion: activeAnchor || 'complex', 
          persona, 
          clientHour: new Date().getHours(),
          history: historyForApi.map(h => ({ role: h.role, content: h.content })),
          isSessionEnding: isEnding
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
      
      // 如果结束，生成最终的小票
      if (isEnding) {
        // 汇总所有用户的发言作为 receipt 内容
        const fullUserMessage = historyForApi.filter(h => h.role === 'user').map(h => h.content).join('\n\n') + (userText !== '[用户主动沉默并准备离开]' ? `\n\n${userText}` : '');
        
        const localEntry = {
          id: Date.now(),
          receiptId: finalReceiptIdRef.current,
          content: fullUserMessage, 
          persona: persona,
          cleanText: finalParsed.cleanText, 
          mind_track: finalParsed.mind_track,
          item: finalParsed.item,           
          timestamp: Date.now(),
          status: '待处理',
          createdAt: new Date().toISOString()
        };
        
        if (ruminationContext) {
          const bjTimestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
          addPatch(ruminationContext.entryId, {
            timestamp: bjTimestamp,
            content: fullUserMessage,
            ai_reply: finalParsed.cleanText,
            mind_track: finalParsed.mind_track,
          });
          setRuminationContext(null);
        } else {
          addEntry(localEntry);
        }
        setGeneratedReceipt(localEntry);
      }
      
      setStreamState('done');
    } catch (error) {
      console.error('AI Stream failed:', error);
      setCleanAiText('信号中断了。店长在后面修基站，早点休息吧。');
      setStreamState('done');
    }
  };

  // 用户主动提交文本
  const handleSubmit = async () => {
    if (!text.trim() || streamState !== 'idle') return;

    // 店长模式直接结单，不允许多轮
    if (persona === 'Manager') {
      finalReceiptIdRef.current = 'EH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const mockEntry = { id: Date.now(), receiptId: finalReceiptIdRef.current, content: text, persona: 'Manager', status: '待处理', timestamp: Date.now() };
      addEntry(mockEntry);
      supabase.from('manager_mailbox').insert([{ receipt_id: mockEntry.receiptId, user_message: text, created_date: new Date().toISOString().split('T')[0] }]).then();
      setGeneratedReceipt(mockEntry);
      setIsSessionEnding(true);
      setStep('receipt');
      return;
    }

    const nextTurnCount = turnCount + 1;
    setTurnCount(nextTurnCount);
    const ending = nextTurnCount >= 5;
    if (ending) setIsSessionEnding(true);

    const newMsg = { id: crypto.randomUUID(), role: 'user' as const, content: text };
    const currentHistory = [...history]; // 传给 API 时不包含当前句
    setHistory([...history, newMsg]);
    setText('');
    
    runTurn(text, ending, currentHistory);
  };

  // 正常继续下一轮
  const handleContinue = () => {
    setHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: cleanAiText }]);
    setCleanAiText('');
    setStreamState('idle');
  };

  // 用户主动终止并触发结局
  const handleForceEnd = () => {
    setIsSessionEnding(true);
    const updatedHistory = [...history, { id: crypto.randomUUID(), role: 'assistant', content: cleanAiText }];
    setHistory(updatedHistory);
    setCleanAiText('');
    runTurn('[用户主动沉默并准备离开]', true, updatedHistory);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      className="relative w-full h-full flex flex-col items-center bg-transparent overflow-y-auto [&::-webkit-scrollbar]:hidden"
    >
      {step === 'chat' && streamState === 'idle' && (
        <button
          onClick={() => setScene('entrance')}
          className="absolute top-12 left-6 md:left-12 tracking-[0.2em] text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors duration-700 outline-none block z-30"
        >
           {lang.HOME.back} 
        </button>
      )}

      <div className="relative w-full max-w-2xl mx-auto flex flex-col py-24 min-h-screen px-6 md:px-12">
        <AnimatePresence mode="wait">
          
          {step === 'chat' && (
            <motion.div key="chat-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col">
              
              {/* 反刍上下文提示 */}
              {ruminationContext && turnCount === 0 && (
                <div className="w-full mb-10 border-l-2 border-zinc-700 pl-4 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase">反刍 · 历史记录</span>
                  <p className="text-[13px] text-zinc-500 tracking-wider leading-relaxed line-clamp-2 opacity-80 mt-1">
                    "{ruminationContext.originalContent}"
                  </p>
                </div>
              )}

              {/* 历史对话流 */}
              <div className="w-full flex flex-col gap-8 mb-6">
                {history.map((msg) => (
                  <div key={msg.id} className={`w-full flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <p className={`text-[14px] md:text-base tracking-widest leading-loose font-light max-w-[85%] whitespace-pre-wrap ${msg.role === 'user' ? 'text-zinc-500 text-right' : 'text-zinc-300 text-left'}`}>
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* 当前流式输出的 AI 文本 */}
              {(streamState === 'loading' || streamState === 'streaming' || streamState === 'done') && (
                 <div className="w-full flex flex-col justify-start mt-2 mb-10">
                    {streamState === 'loading' && !cleanAiText && (
                      <p className="text-zinc-600 tracking-[0.2em] text-[13px] animate-pulse">...</p>
                    )}
                    <p className="text-zinc-300 text-[14px] md:text-base tracking-widest leading-loose font-light text-left whitespace-pre-wrap max-w-[85%]">
                      {cleanAiText}
                    </p>
                 </div>
              )}

              {/* 物理物品渲染 (仅在强制结单时出现) */}
              {streamState === 'done' && isSessionEnding && aiItem && !ruminationContext && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-12 border border-zinc-800/50 bg-zinc-900/20 p-4 rounded-sm w-fit flex flex-col items-start gap-2 self-start">
                  <div className="text-zinc-400 text-[13px] tracking-widest">[ 吧台上多了一样东西：{aiItem.name} ]</div>
                  <div className="text-zinc-600 text-xs tracking-wider">{aiItem.desc}</div>
                </motion.div>
              )}

              {/* 交互按钮组 */}
              {streamState === 'done' && !isSessionEnding && (
                 <div className="flex flex-wrap items-center gap-6 mt-4 pb-20">
                    <button onClick={handleContinue} className="tracking-[0.2em] text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors outline-none border border-zinc-800/50 px-4 py-2 bg-zinc-900/30">
                      [ 继续倾诉 ]
                    </button>
                    <button onClick={handleForceEnd} className="tracking-[0.2em] text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors outline-none">
                      [ 聊得差不多了 ]
                    </button>
                 </div>
              )}

              {streamState === 'done' && isSessionEnding && (
                 <div className="flex justify-center mt-12 pb-20">
                    <button onClick={() => setStep('receipt')} className="tracking-[0.3em] text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors duration-700 outline-none border border-zinc-800/50 px-8 py-3 rounded-sm bg-zinc-950/30">
                      {lang.SPEAKING.print}
                    </button>
                 </div>
              )}

              {/* 用户输入框 (仅在 Idle 状态展现) */}
              {streamState === 'idle' && !isSessionEnding && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex flex-col items-center mt-4 border-t border-zinc-900/50 pt-8 pb-20">
                  <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={turnCount === 0 && ruminationContext ? '现在又有什么感觉...' : lang.SPEAKING.placeholder}
                    className="w-full h-32 bg-transparent outline-none resize-none font-mono text-zinc-400 caret-zinc-500 text-[14px] md:text-base tracking-wider leading-relaxed placeholder:text-zinc-700"
                  />
                  
                  {turnCount === 0 && (
                    <div className="w-full flex flex-wrap gap-4 mt-2 justify-start mb-6">
                      {EMOTION_ANCHORS.map(anchor => (
                        <button key={anchor} onClick={() => setActiveAnchor(activeAnchor === anchor ? null : anchor)} className={`text-[11px] tracking-[0.1em] transition-colors duration-500 outline-none ${activeAnchor === anchor ? 'text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}>
                          [ {anchor} ]
                        </button>
                      ))}
                    </div>
                  )}

                  {text.trim().length > 0 && (
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 w-full mt-4">
                      {turnCount === 0 && (
                        <div className="flex flex-wrap items-center gap-4 text-[12px] font-mono tracking-[0.1em]">
                          <span className="text-zinc-700">{lang.SPEAKING.to}</span> 
                          {PERSONAS.map((p) => (
                            <button key={p.id} onClick={() => setPersona(p.id)} className={`transition-colors outline-none ${persona === p.id ? 'text-zinc-300' : 'text-zinc-700 hover:text-zinc-500'}`}>
                              {persona === p.id ? `[ ${p.label} ]` : p.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <button onClick={handleSubmit} className="tracking-[0.2em] text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors ml-auto outline-none whitespace-nowrap">
                         {lang.SPEAKING.submit}   
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* 小票结算期 */}
          {step === 'receipt' && generatedReceipt && (
            <motion.div key="receipt-stage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="w-full flex flex-col items-center pb-20">
              <div className="w-full max-w-[400px] mx-auto">
                <Receipt 
                    type="memo" status="normal"
                    data={{
                        receiptId: generatedReceipt.receiptId,
                        timestamp: generatedReceipt.timestamp,
                        user_message: generatedReceipt.content,
                        ai_name: generatedReceipt.persona !== 'Manager' ? generatedReceipt.persona : undefined,
                        ai_reply: generatedReceipt.persona !== 'Manager' ? generatedReceipt.cleanText : undefined,
                        manager_reply: null 
                    }}
                />
              </div>
              <button onClick={() => setScene('entrance')} className="mt-16 text-zinc-600 hover:text-zinc-400 text-[11px] tracking-[0.3em] uppercase transition-colors duration-700 outline-none block">
                 {lang.SPEAKING.leave}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}