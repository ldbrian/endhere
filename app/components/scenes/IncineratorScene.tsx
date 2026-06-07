'use client';

import { useState, useEffect, useRef } from 'react';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { useLanguage } from '../../hooks/useLanguage';
import { Receipt } from '../ui/Receipt'; 

export default function IncineratorScene() {
  const { setScene, incineratorTarget, setIncineratorTarget } = useSpaceStore();
  const { removeEntry } = useShelterStore();
  const lang = useLanguage();
  
  const [report, setReport] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isAnnihilating, setIsAnnihilating] = useState(false);
  
  // CTO 修复：并发锁，防御 React 18 的双重触发机制导致的流式响应交叉错乱
  const scanTriggered = useRef(false);

  useEffect(() => {
    if (!incineratorTarget) {
      setScene('entrance');
      return;
    }
    
    // 只有在锁未开启时才执行请求
    if (!scanTriggered.current && !report) {
      scanTriggered.current = true;
      triggerScan();
    }
  }, []);

  const triggerScan = async () => {
    setIsScanning(true);
    setReport('');
    
    let targetContext = '';
    if (incineratorTarget.type === 'virtual_item') {
      targetContext = `[实体旧物]：${incineratorTarget.content}`;
    } else {
      targetContext = `[热敏纸上的对话记忆] 摘要："${incineratorTarget.content}"`;
    }

    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: targetContext, persona: 'Scanner' }) 
      });
      
      if (!res.body) throw new Error('No response body');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        setReport((prev) => prev + chunkText);
      }
    } catch (err) {
      setReport("[SYS.ERR] 鉴定模块离线，残骸解析失败。");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAnnihilate = () => {
    setIsAnnihilating(true);
    
    setTimeout(() => {
      if (incineratorTarget) {
        removeEntry(incineratorTarget.id);
        setIncineratorTarget(null);
      }
      setScene('entrance');
    }, 3500);
  };

  if (!incineratorTarget) return null;

  return (
    <div className="relative w-full h-full bg-[#030303] flex flex-col items-center justify-center select-none font-mono overflow-hidden">
      
      <style>{`
        @keyframes annihilate-down {
          0% { filter: none; opacity: 1; transform: scale(1); }
          25% { filter: brightness(2) contrast(1.5); opacity: 1; transform: scale(0.98); }
          70% { filter: invert(1) hue-rotate(180deg) blur(2px); opacity: 0.8; transform: skewX(-5deg) scaleY(0.9); }
          100% { filter: brightness(0) blur(6px); opacity: 0; transform: translateY(40px) skewX(-15deg) scale(0.8); }
        }
        .animate-annihilate-down {
          animation: annihilate-down 3.5s forwards cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes text-burn {
          0% { color: #71717a; text-shadow: none; }
          25% { color: #FFFFFF; text-shadow: 0 0 10px #FFFFFF; }
          70% { color: #1A1A1A; text-shadow: none; filter: blur(1px); }
          100% { color: #1A1A1A; opacity: 0; filter: blur(4px); }
        }
        .animate-text-burn {
          animation: text-burn 3.5s forwards cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {!isAnnihilating && (
        <button
          onClick={() => {
            setIncineratorTarget(null);
            setScene('nostalgia');
          }}
          className="absolute top-10 left-8 tracking-[0.2em] text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors duration-500 outline-none z-20"
        >
          [ 取消 / 退回抽屉 ]
        </button>
      )}

      <div className="flex flex-col items-center justify-center w-full max-w-md px-6 gap-12">
        
        <div className={`w-full flex justify-center transition-all ${isAnnihilating ? 'animate-annihilate-down' : ''}`}>
          {incineratorTarget.type === 'virtual_item' ? (
            <div className="w-full max-w-[280px] bg-white/[0.02] border border-zinc-800 rounded-none p-6 text-left">
              <p className="text-zinc-400 text-[13px] tracking-widest font-light leading-relaxed">
                {incineratorTarget.content}
              </p>
              <div className="mt-4 text-zinc-700 text-[10px] tracking-widest font-mono">
                {new Date(incineratorTarget.timestamp).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="scale-90 opacity-80 pointer-events-none">
              <Receipt 
                type="memo" 
                status="normal"
                lang={lang}
                data={{
                  receiptId: incineratorTarget.receiptId,
                  timestamp: incineratorTarget.timestamp,
                  user_message: incineratorTarget.content,
                  ai_name: incineratorTarget.persona !== 'Manager' ? incineratorTarget.persona : undefined,
                  ai_reply: incineratorTarget.persona !== 'Manager' ? (incineratorTarget.punchline || incineratorTarget.rawResponse) : undefined,
                  manager_reply: incineratorTarget.manager_message
                }} 
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-10 min-h-[120px] w-full">
          {isScanning && !report ? (
            <p className="text-zinc-600 text-[11px] tracking-widest animate-pulse">
              [ 正在扫描物理与数字结构... ]
            </p>
          ) : (
            report && (
              <>
                {/* CDO 修复：增加 w-full max-w-[320px] px-4 确保移动端不顶边，规范行高 */}
                <p className={`w-full max-w-[320px] px-4 text-zinc-500 text-[13px] tracking-[0.15em] font-light leading-relaxed text-center ${isAnnihilating ? 'animate-text-burn' : ''}`}>
                  {report}
                </p>
                
                {!isAnnihilating && (
                  <button 
                    onClick={handleAnnihilate}
                    className="text-[11px] text-red-900/40 hover:text-red-600 transition-colors tracking-widest outline-none border border-red-900/20 px-6 py-2"
                  >
                    [ 确认启动焚烧程序 ]
                  </button>
                )}
              </>
            )
          )}
        </div>
        
      </div>
    </div>
  );
}