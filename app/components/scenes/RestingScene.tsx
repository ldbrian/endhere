'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useTimeAccumulator } from '../../hooks/useTimeAccumulator';
import { useLanguage } from '../../hooks/useLanguage';

// ============================================================
// 三阶线性降速：靠岸 -> 漂流 -> 悬浮
// ============================================================

const STAGE1_END = 45 * 1000;       // 阶段一结束：45秒
const STAGE2_END = 3 * 60 * 1000;   // 阶段二结束：3分钟

// 阶段一：靠岸（0-45秒），文本呈现频率紧凑
const STAGE1_SETS: string[][] = [
  [
    '接下来这段时间，不用回复任何东西。',
    '没有人需要你做决定。',
    '如果想离开，随时都可以。',
  ],
  [
    '不用想接下来要做什么。',
    '这里没有需要完成的事。',
    '你可以什么都不做。',
  ],
  [
    '不需要回应任何人。',
    '没有人在等你的消息。',
    '随时可以离开这里。',
  ],
];

// 阶段一节奏：呈现 + 留白（毫秒）
const STAGE1_DISPLAY = 5000;
const STAGE1_GAP = 3000;

// 阶段二：漂流（45秒-3分钟），频率拉长，从躯体感知向环境转移
const STAGE2_SETS: string[][] = [
  [
    '你的肩膀好像有点紧。',
    '可以慢慢放下来。',
    '呼吸可以再慢一点。',
  ],
  [
    '手可以放松地垂着。',
    '不用握紧什么。',
    '眼睛可以看向任何地方。',
  ],
  [
    '背靠着的地方，是稳的。',
    '脚踩着的地方，是稳的。',
    '不需要保持任何姿势。',
  ],
];

// 阶段二节奏：呈现 + 留白
const STAGE2_DISPLAY = 6000;
const STAGE2_GAP = 8000;

// 阶段三：悬浮（3分钟以后），切断实质性文本
// 偶尔闪烁一次 "..."，间隔 >= 15 秒；偶尔（更低概率）插入一条 AI 世界碎片
const STAGE3_DOT_INTERVAL_MIN = 15000;
const STAGE3_DOT_INTERVAL_MAX = 25000;
const STAGE3_DOT_DISPLAY = 2000;
const STAGE3_FRAGMENT_PROBABILITY = 0.35; // 每个周期有 35% 概率展示一条 AI 碎片而非 "..."

const FADE_DURATION = 2000;

export default function RestingScene() {
  const setScene = useSpaceStore((state) => state.setScene);
  const lang = useLanguage();

  const accumulatedTime = useTimeAccumulator();

  const [currentText, setCurrentText] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0);
  const [stage, setStage] = useState<1 | 2 | 3>(1);

  // 🍬 物理彩蛋系统状态（保留）
  const [filterColor, setFilterColor] = useState('bg-transparent');
  const [synesthesiaText, setSynesthesiaText] = useState('');
  const [isMintConsumed, setIsMintConsumed] = useState(false);
  const [isOrangeConsumed, setIsOrangeConsumed] = useState(false);

  const mountedRef = useRef(true);
  const startTimeRef = useRef(Date.now());
  const wakeLockRef = useRef<any>(null);
  const fragmentQueueRef = useRef<string[]>([]);
  const isFetchingFragmentRef = useRef(false);

  // ==========================================
  // Wake Lock：进入即生效，卸载即释放
  // ==========================================
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) {
        console.warn('[WakeLock] not available or denied:', e);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // ==========================================
  // AI 世界碎片预取（阶段三使用）
  // ==========================================
  const fetchFragments = async () => {
    if (isFetchingFragmentRef.current) return;
    isFetchingFragmentRef.current = true;
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
        fragmentQueueRef.current.push(...data.thoughts);
      }
    } catch (e) {
      console.error('[Fragment Fetch Error]:', e);
    } finally {
      isFetchingFragmentRef.current = false;
    }
  };

  // ==========================================
  // 主时间轴循环
  // ==========================================
  useEffect(() => {
    mountedRef.current = true;
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // 随机选一套文案
    const set1 = STAGE1_SETS[Math.floor(Math.random() * STAGE1_SETS.length)];
    const set2 = STAGE2_SETS[Math.floor(Math.random() * STAGE2_SETS.length)];

    const showText = async (text: string, displayMs: number) => {
      if (!mountedRef.current) return;
      setCurrentText(text);
      setOpacity(1);
      await delay(FADE_DURATION + displayMs);
      if (!mountedRef.current) return;
      setOpacity(0);
      await delay(FADE_DURATION);
      if (!mountedRef.current) return;
      setCurrentText(null);
    };

    const showDot = async () => {
      if (!mountedRef.current) return;
      setCurrentText('...');
      setOpacity(1);
      await delay(FADE_DURATION + STAGE3_DOT_DISPLAY);
      if (!mountedRef.current) return;
      setOpacity(0);
      await delay(FADE_DURATION);
      if (!mountedRef.current) return;
      setCurrentText(null);
    };

    const run = async () => {
      // ---------- 阶段一：靠岸 ----------
      setStage(1);
      for (const line of set1) {
        if (!mountedRef.current) return;
        if (Date.now() - startTimeRef.current >= STAGE1_END) break;
        await showText(line, STAGE1_DISPLAY);
        await delay(STAGE1_GAP);
      }

      while (mountedRef.current && Date.now() - startTimeRef.current < STAGE1_END) {
        await delay(1000);
      }

      // ---------- 阶段二：漂流 ----------
      if (!mountedRef.current) return;
      setStage(2);
      fetchFragments();

      for (const line of set2) {
        if (!mountedRef.current) return;
        if (Date.now() - startTimeRef.current >= STAGE2_END) break;
        await showText(line, STAGE2_DISPLAY);
        await delay(STAGE2_GAP);
      }

      while (mountedRef.current && Date.now() - startTimeRef.current < STAGE2_END) {
        await delay(1000);
      }

      // ---------- 阶段三：悬浮 ----------
      if (!mountedRef.current) return;
      setStage(3);

      while (mountedRef.current) {
        const interval = STAGE3_DOT_INTERVAL_MIN + Math.random() * (STAGE3_DOT_INTERVAL_MAX - STAGE3_DOT_INTERVAL_MIN);
        await delay(interval);
        if (!mountedRef.current) break;

        const useFragment = Math.random() < STAGE3_FRAGMENT_PROBABILITY && fragmentQueueRef.current.length > 0;
        if (useFragment) {
          const text = fragmentQueueRef.current.shift()!;
          await showText(text, STAGE2_DISPLAY);
          if (fragmentQueueRef.current.length < 2) fetchFragments();
        } else {
          await showDot();
        }
      }
    };

    run();

    return () => { mountedRef.current = false; };
  }, []);

  // ==========================================
  // 物理彩蛋交互（保留）
  // ==========================================
  const handleConsume = (type: 'mint' | 'orange') => {
    if (type === 'mint') {
      setIsMintConsumed(true);
      setSynesthesiaText(`[ ${lang.RESTING.consumeMint} ]`);
      setFilterColor('bg-cyan-900/5');
    } else {
      setIsOrangeConsumed(true);
      setSynesthesiaText(`[ ${lang.RESTING.consumeOrange} ]`);
      setFilterColor('bg-orange-800/5');
    }

    setTimeout(() => {
      setSynesthesiaText('');
      setFilterColor('bg-transparent');
    }, 8000);
  };

  const showMint = accumulatedTime > 300 && !isMintConsumed && !synesthesiaText;
  const showOrange = accumulatedTime > 900 && !isOrangeConsumed && !synesthesiaText;

  // ==========================================
  // UI 渲染层：绝对真空，纯黑背景
  // ==========================================
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black select-none font-mono overflow-hidden">

      {/* 色彩滤镜层（进食彩蛋时触发，极低透明度，不破坏真空感） */}
      <div className={`absolute inset-0 pointer-events-none transition-colors duration-[5000ms] ease-in-out z-0 ${filterColor}`} />

      {/* 核心文字渲染区 */}
      <div className="relative flex flex-col items-center justify-center px-8 w-full max-w-lg h-32 z-10">
        <AnimatePresence mode="wait">
          {synesthesiaText ? (
            <motion.p
              key="synesthesia"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 2, ease: 'easeInOut' }}
              className="text-zinc-300 text-[13px] md:text-sm tracking-[0.2em] font-light leading-relaxed text-center"
            >
              {synesthesiaText}
            </motion.p>
          ) : (
            <div
              key="drift-text"
              className="w-full text-center flex items-center justify-center pointer-events-none"
              style={{
                opacity,
                transitionProperty: 'opacity',
                transitionDuration: `${FADE_DURATION}ms`,
                transitionTimingFunction: 'ease-in-out'
              }}
            >
              <span className={`text-zinc-500 tracking-[0.2em] font-light leading-loose ${stage === 3 ? 'text-[12px]' : 'text-[13px]'}`}>
                {currentText}
              </span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 物理彩蛋按钮区 */}
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

      {/* 视觉降权退出按钮：左上角，极暗、极小 */}
      <button
        onClick={() => setScene('entrance')}
        className="absolute top-8 left-8 tracking-[0.3em] text-[9px] text-zinc-800 hover:text-zinc-600 transition-colors duration-1000 outline-none uppercase z-20"
      >
       {lang.HOME.back}
      </button>

    </div>
  );
}