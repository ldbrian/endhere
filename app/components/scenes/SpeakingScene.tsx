'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { supabase } from '../../lib/supabase';
import { Receipt } from '../ui/Receipt';
import { track } from '../../lib/track';
import { useWorldSummary } from '../../hooks/useWorldSummary';
import { useLanguage } from '../../hooks/useLanguage';

const PERSONAS = [
  { id: 'Manager', label: '店长' },
  { id: 'Ash', label: 'Ash (调酒师)' },
  { id: 'Rin', label: 'Rin (倾听者)' },
  { id: 'Child', label: '8岁的自己' }
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
  
  const [history, setHistory] = useState<{id: string, role: 'user'|'assistant', content: string}[]>([]);
  const [currentAiText, setCurrentAiText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [text, setText] = useState('');
  
  const [persona, setPersona] = useState('Ash');
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  
  const [step, setStep] = useState<'chat' | 'receipt'>('chat');
  const [generatedReceipt, setGeneratedReceipt] = useState<any | null>(null);
  const [aiItem, setAiItem] = useState<any | null>(null);

  const finalReceiptIdRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, currentAiText]);

  // 🟢 CTO 修复：接收 mindTrack 参数，并补充缺失的类型字段以通过 TS 编译
  const finalizeReceipt = (finalAiText: string, parsedItem: any, mindTrack: string | null = null) => {
    const fullUserMessage = history.filter(h => h.role === 'user').map(h => h.content).join('\n\n');
    
    const entryData = {
      id: Date.now(),
      receiptId: finalReceiptIdRef.current,
      content: fullUserMessage,
      persona: persona,
      cleanText: finalAiText,
      item: parsedItem,
      mind_track: mindTrack || '', // 保证非 undefined
      timestamp: Date.now(),
      status: '待处理',
      createdAt: new Date().toISOString()
    };

    if (ruminationContext) {
      const bjTimestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      addPatch(ruminationContext.entryId, {
        timestamp: bjTimestamp,
        content: fullUserMessage,
        ai_reply: finalAiText,
        mind_track: mindTrack || '' // 🟢 补齐 Store 要求的类型签名
      });
      setRuminationContext(null);
    } else {
      addEntry(entryData);
    }

    setGeneratedReceipt(entryData);
    setAiItem(parsedItem);
    setStep('receipt');
  };

  const handleSend = async (isForcedEnd: boolean = false) => {
    const userMessage = isForcedEnd ? "[沉默...]" : text.trim();
    if (!userMessage && !isForcedEnd) return;
    if (isTyping) return;

    if (!finalReceiptIdRef.current) {
      finalReceiptIdRef.current = 'EH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const nextTurn = turnCount + 1;
    setTurnCount(nextTurn);
    
    const newHistory = [...history, { id: crypto.randomUUID(), role: 'user' as const, content: userMessage }];
    setHistory(newHistory);
    setText('');
    
    // 🟢 CTO 修复：店长路线补充反刍补丁逻辑及类型补齐
    if (persona === 'Manager') {
      const exitText = '……话说完了就出去吧。单据在桌上，自己拿。';
      const fullUserMessage = newHistory.filter(h => h.role === 'user').map(h => h.content).join('\n\n');
      
      const entryData = {
        id: Date.now(),
        receiptId: finalReceiptIdRef.current,
        content: fullUserMessage,
        persona: 'Manager',
        cleanText: exitText,
        item: null,
        mind_track: '',
        timestamp: Date.now(),
        status: '待处理',
        createdAt: new Date().toISOString()
      };
      
      if (ruminationContext) {
        const bjTimestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        addPatch(ruminationContext.entryId, {
          timestamp: bjTimestamp,
          content: fullUserMessage,
          ai_reply: exitText,
          mind_track: ''
        });
        setRuminationContext(null);
      } else {
        addEntry(entryData);
      }
      
      supabase.from('manager_mailbox').insert([{ 
        receipt_id: entryData.receiptId, 
        user_message: fullUserMessage,
        created_date: new Date().toISOString().split('T')[0] 
      }]).then();

      setGeneratedReceipt(entryData);
      setAiItem(null);
      setStep('receipt');
      return; 
    }

    setIsTyping(true);
    const isEnding = isForcedEnd || nextTurn >= 5;

    try {
      const anchorContext = activeAnchor && nextTurn === 1 ? `[系统：用户带着情绪标签：“${activeAnchor}”。]\n` : '';
      const ruminCtxStr = ruminationContext && nextTurn === 1
        ? `[系统：用户目前正在反刍一张过去的记录。他过去说："${ruminationContext.originalContent}"。请基于此倾听他现在的感受。]\n` : '';
      
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: `${ruminCtxStr}${anchorContext}${userMessage}`,
          context_tag: activeAnchor, 
          persona, 
          clientHour: new Date().getHours(),
          history: history, 
          isSessionEnding: isEnding
        }),
      });

      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const parsed = parseAiResponse(buffer);
        setCurrentAiText(parsed.cleanText);
      }

      const finalParsed = parseAiResponse(buffer);
      
      setIsTyping(false);
      setCurrentAiText('');
      setHistory([...newHistory, { id: crypto.randomUUID(), role: 'assistant', content: finalParsed.cleanText }]);

      if (isEnding) {
        // 🟢 CTO 修复：透传解析出的 mind_track
        finalizeReceipt(finalParsed.cleanText, finalParsed.item, finalParsed.mind_track);
      }

    } catch (error) {
      setIsTyping(false);
      const fallback = '信号中断了...';
      setHistory([...newHistory, { id: crypto.randomUUID(), role: 'assistant', content: fallback }]);
      if (isEnding) finalizeReceipt(fallback, null, '');
    }
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-transparent overflow-hidden select-none font-mono">
      
      {step === 'chat' && (
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#030303] via-[#030303]/80 to-transparent z-20 pointer-events-none flex items-start p-8">
          <button
            onClick={() => {
              setRuminationContext(null);
              setScene('entrance');
            }}
            className="tracking-[0.2em] text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors duration-500 outline-none pointer-events-auto mt-2"
          >
            {lang.HOME.back}
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'chat' ? (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col pt-12 pb-24 relative">
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 pb-6 [&::-webkit-scrollbar]:hidden relative z-10">
              <div className="w-full h-24 shrink-0 pointer-events-none" /> 

              <div className="max-w-2xl mx-auto flex flex-col gap-8">
                {ruminationContext && turnCount === 0 && (
                  <div className="w-full border-l-2 border-zinc-800 pl-4 mb-4">
                    <span className="text-[10px] text-zinc-600 tracking-[0.2em]">反刍 · 过去记录</span>
                    <p className="text-[13px] text-zinc-500 tracking-wider mt-2 opacity-70">
                      "{ruminationContext.originalContent}"
                    </p>
                  </div>
                )}

                {history.map((msg) => (
                  <div key={msg.id} className={`w-full flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <p className={`text-[14px] md:text-base tracking-widest leading-loose font-light max-w-[100%] whitespace-pre-wrap ${msg.role === 'user' ? 'text-zinc-500 text-right' : 'text-zinc-300 text-left'}`}>
                      {msg.content}
                    </p>
                  </div>
                ))}

                {isTyping && (
                  <div className="w-full flex justify-start">
                    <p className="text-zinc-300 text-[14px] md:text-base tracking-widest leading-loose font-light max-w-[100%] whitespace-pre-wrap">
                      {currentAiText || <span className="animate-pulse text-zinc-600 text-[12px]">...</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 w-full max-w-2xl mx-auto z-30 mb-8 md:mb-12 px-8">
              <div className="flex flex-col w-full">
                
                {turnCount === 0 && history.length === 0 && (
                  <>
                    <div className="flex flex-wrap gap-x-6 gap-y-5 mb-10">
                      {EMOTION_ANCHORS.map(anchor => (
                        <button 
                          key={anchor} 
                          onClick={() => setActiveAnchor(activeAnchor === anchor ? null : anchor)} 
                          className={`text-[12px] tracking-[0.1em] transition-colors outline-none ${activeAnchor === anchor ? 'text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                          [ {anchor} ]
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-5 mb-8">
                      {PERSONAS.map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => setPersona(p.id)} 
                          className={`text-[12px] tracking-widest outline-none transition-colors ${persona === p.id ? 'text-zinc-300' : 'text-zinc-700 hover:text-zinc-500'}`}
                        >
                          {persona === p.id ? `[ ${p.label} ]` : p.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex items-end gap-6 w-full border-t border-zinc-800/30 pt-8">
                  <textarea
                    autoFocus
                    disabled={isTyping}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={isTyping ? "..." : (turnCount === 0 ? "在这里写下吧..." : "继续说...")}
                    className="flex-1 h-20 bg-transparent outline-none resize-none font-mono text-zinc-400 caret-zinc-500 text-[14px] md:text-base tracking-widest placeholder:text-zinc-700/50 leading-relaxed"
                  />
                  <div className="flex flex-col gap-4 pb-2 shrink-0">
                    <button onClick={() => handleSend(false)} disabled={isTyping || !text.trim()} className="text-[13px] text-zinc-500 hover:text-zinc-300 disabled:opacity-30 tracking-[0.2em] outline-none text-right whitespace-nowrap">
                      [ 发送 ]
                    </button>
                    {history.length > 0 && !isTyping && persona !== 'Manager' && (
                      <button onClick={() => handleSend(true)} className="text-[12px] text-zinc-600 hover:text-zinc-400 tracking-[0.2em] outline-none text-right whitespace-nowrap">
                        [ 打印小票 ]
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </motion.div>
        ) : (
          <motion.div key="receipt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full h-full flex flex-col items-center justify-center overflow-y-auto px-8 py-24">
            <div className="w-full max-w-[400px] mx-auto flex flex-col items-center">
              
              {aiItem && !ruminationContext && persona !== 'Manager' && (
                <div className="mb-12 border border-zinc-800/50 bg-zinc-900/20 p-4 w-full flex flex-col items-center gap-2 text-center">
                  <div className="text-zinc-400 text-[13px] tracking-widest">[ {persona} 留给你一样东西：{aiItem.name} ]</div>
                  <div className="text-zinc-600 text-xs tracking-wider">{aiItem.desc}</div>
                </div>
              )}

              <Receipt 
                type="memo" status="normal"
                data={{
                  receiptId: generatedReceipt.receiptId,
                  timestamp: generatedReceipt.timestamp,
                  user_message: generatedReceipt.content,
                  ai_name: generatedReceipt.persona !== 'Manager' ? generatedReceipt.persona : undefined,
                  ai_reply: generatedReceipt.cleanText,
                  manager_reply: null 
                }}
              />
              
              <button onClick={() => {
                setRuminationContext(null);
                setScene('entrance');
              }} className="mt-16 text-zinc-600 hover:text-zinc-400 text-[11px] tracking-[0.3em] uppercase transition-colors duration-700 outline-none">
                 {lang.SPEAKING.leave}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}