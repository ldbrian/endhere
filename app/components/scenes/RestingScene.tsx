'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useTimeAccumulator } from '../../hooks/useTimeAccumulator';
import { useLanguage } from '../../hooks/useLanguage';

// ⏳ 时间滴漏引擎参数
const TARGET_SLICES = 47; // 约等于 30 分钟的精准切片数
const FADE_DURATION = 2000; // 淡入淡出各 2 秒
const DISPLAY_DURATION = 6000; // 满显 6 秒
const BASE_BLANK_INTERVAL = 5000; // 基础留白 5 秒
const BLANK_INCREMENT = 1000; // 每次递增 1 秒

export default function RestingScene() {
  const setScene = useSpaceStore((state) => state.setScene);
  const lang = useLanguage();
  
  // 🎒 继承自旧版的时长统计系统
  const accumulatedTime = useTimeAccumulator();

  // 🧠 大模型潜意识队列状态
  const [queue, setQueue] = useState<string[]>([]);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // 🍬 物理彩蛋系统状态
  const [filterColor, setFilterColor] = useState('bg-transparent');
  const [synesthesiaText, setSynesthesiaText] = useState('');
  const [isMintConsumed, setIsMintConsumed] = useState(false);
  const [isOrangeConsumed, setIsOrangeConsumed] = useState(false);

  // ⚙️ 引擎底座
  const isFetchingRef = useRef(false);
  const stepIndexRef = useRef(0);
  const loopActiveRef = useRef(false);
  const mountedRef = useRef(true);

  // ==========================================
  // 核心 1：潜意识装填引擎 (LLM Fetcher)
  // ==========================================
  const fetchThoughts = async () => {
    if (isFetchingRef.current || stepIndexRef.current >= TARGET_SLICES) return;
    isFetchingRef.current = true;
    
    try {
      const now = new Date();
      const res = await fetch('/api/daydream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientHour: now.getHours(), 
          clientDay: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
        })
      });
      const data = await res.json();
      if (data.thoughts && Array.isArray(data.thoughts)) {
        setQueue(prev => [...prev, ...data.thoughts]);
      }
    } catch (e) {
      console.error('[Engine Error]:', e);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchThoughts();
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (queue.length <= 2 && !isFetchingRef.current && stepIndexRef.current + queue.length < TARGET_SLICES) {
      fetchThoughts();
    }
  }, [queue]);

  // ==========================================
  // 核心 2：渐进式滴漏循环 (Time Drip Loop)
  // ==========================================
  useEffect(() => {
    if (loopActiveRef.current || isFinished) return;
    if (stepIndexRef.current < TARGET_SLICES && queue.length === 0) return;

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const runCycle = async () => {
      loopActiveRef.current = true;

      // 判断终点
      if (stepIndexRef.current >= TARGET_SLICES) {
        setIsFinished(true);
        loopActiveRef.current = false;
        return;
      }

      // 取出弹药
      const thought = queue[0];
      setQueue(prev => prev.slice(1));

      // 动作1：淡入
      setCurrentText(thought);
      setOpacity(1); 
      await delay(FADE_DURATION + DISPLAY_DURATION);
      if (!mountedRef.current) return;

      // 动作2：淡出
      setOpacity(0);
      await delay(FADE_DURATION);
      if (!mountedRef.current) return;
      setCurrentText(null); 

      // 动作3：递增留白
      const currentInterval = BASE_BLANK_INTERVAL + (stepIndexRef.current * BLANK_INCREMENT);
      stepIndexRef.current++;
      
      await delay(currentInterval);
      if (!mountedRef.current) return;

      loopActiveRef.current = false;
      setQueue(prev => [...prev]); 
    };

    runCycle();
  }, [queue, isFinished]);

  // ==========================================
  // 核心 3：物理彩蛋交互 (Consumables)
  // ==========================================
  const handleConsume = (type: 'mint' | 'orange') => {
    if (type === 'mint') {
      setIsMintConsumed(true);
      setSynesthesiaText(`[ ${lang.RESTING.consumeMint} ]`);
      setFilterColor('bg-cyan-900/10');
    } else {
      setIsOrangeConsumed(true);
      setSynesthesiaText(`[ ${lang.RESTING.consumeOrange} ]`);
      setFilterColor('bg-orange-800/10');
    }

    // 感官覆盖持续 8 秒后消散
    setTimeout(() => {
      setSynesthesiaText('');
      setFilterColor('bg-transparent');
    }, 8000);
  };

  const showMint = accumulatedTime > 300 && !isMintConsumed && !synesthesiaText;
  const showOrange = accumulatedTime > 900 && !isOrangeConsumed && !synesthesiaText;

  // ==========================================
  // UI 渲染层 (CDO 规范：优先级隔离)
  // ==========================================
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#030303] select-none font-mono overflow-hidden">
      
      {/* 色彩滤镜层 (进食彩蛋时触发) */}
      <div className={`absolute inset-0 pointer-events-none transition-colors duration-[5000ms] ease-in-out z-0 ${filterColor}`} />

      {/* 核心文字渲染区 */}
      <div className="relative flex flex-col items-center justify-center px-8 w-full max-w-lg h-32 z-10">
        <AnimatePresence mode="wait">
          {/* 优先级 1：物理彩蛋通感文字 */}
          {synesthesiaText ? (
            <motion.p 
              key="synesthesia" 
              initial={{ opacity: 0, filter: 'blur(4px)' }} 
              animate={{ opacity: 1, filter: 'blur(0px)' }} 
              exit={{ opacity: 0, filter: 'blur(4px)' }} 
              transition={{ duration: 2, ease: 'easeOut' }} 
              className="text-zinc-300 text-[13px] md:text-sm tracking-[0.2em] font-light leading-relaxed text-center"
            >
              {synesthesiaText}
            </motion.p>
          ) : isFinished ? (
            /* 优先级 2：30分钟闭环终结文案 */
            <motion.p 
              key="finished" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ duration: 3 }} 
              className="text-zinc-600 text-[12px] tracking-[0.3em] font-light"
            >
              [ 半小时了。时间开始重新流动。 ]
            </motion.p>
          ) : (
            /* 优先级 3：底层的渐进式大模型滴漏文字 */
            <div 
              key="daydream-text"
              className="w-full text-center flex items-center justify-center pointer-events-none"
              style={{ 
                opacity, 
                transitionProperty: 'opacity',
                transitionDuration: `${FADE_DURATION}ms`,
                transitionTimingFunction: 'ease-in-out'
              }}
            >
              <span className="text-[13px] text-zinc-500 tracking-[0.2em] font-light leading-loose">
                {currentText}
              </span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 物理彩蛋按钮区 (满足时长后浮现) */}
      <div className="absolute bottom-32 flex flex-col items-center justify-center h-16 gap-6 z-10">
        <AnimatePresence>
          {showMint && (
            <motion.button 
              key="mint-candy" 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 3 }} 
              onClick={() => handleConsume('mint')} 
              className="text-zinc-500 opacity-40 hover:opacity-100 hover:text-cyan-200 text-[11px] tracking-[0.3em] font-light transition-all duration-1000 outline-none cursor-pointer"
            >
               {lang.RESTING.mint} 
            </motion.button>
          )}
          {showOrange && (
            <motion.button 
              key="half-orange" 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 3 }} 
              onClick={() => handleConsume('orange')} 
              className="text-zinc-500 opacity-40 hover:opacity-100 hover:text-orange-200 text-[11px] tracking-[0.3em] font-light transition-all duration-1000 outline-none cursor-pointer"
            >
               {lang.RESTING.orange} 
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* 常驻退出舱门 */}
      <button
        onClick={() => setScene('entrance')}
        className={`absolute bottom-12 tracking-[0.3em] text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors duration-700 outline-none uppercase z-20 ${
          isFinished ? 'animate-pulse' : ''
        }`}
      >
       {lang.HOME.back}
      </button>

    </div>
  );
}