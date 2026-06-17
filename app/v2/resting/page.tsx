'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const STAGE1_END = 45 * 1000;
const STAGE2_END = 3 * 60 * 1000;

const STAGE1_SETS = [
  ['接下来这段时间，不用回复任何东西。', '没有人需要你做决定。', '如果想离开，随时都可以。'],
  ['不用想接下来要做什么。', '这里没有需要完成的事。', '你可以什么都不做。'],
];

const STAGE2_SETS = [
  ['你的肩膀好像有点紧。', '可以慢慢放下来。', '呼吸可以再慢一点。'],
  ['背靠着的地方，是稳的。', '脚踩着的地方，是稳的。', '不需要保持任何姿势。'],
];

const DISPLAY_MS = 5000;
const GAP_MS = 3000;
const FADE_DURATION = 2000;

export default function V2RestingPage() {
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0);
  const mountedRef = useRef(true);
  const startTimeRef = useRef(Date.now());
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) {
        console.warn('[WakeLock] not available:', e);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    const set1 = STAGE1_SETS[Math.floor(Math.random() * STAGE1_SETS.length)];
    const set2 = STAGE2_SETS[Math.floor(Math.random() * STAGE2_SETS.length)];

    const showText = async (text: string) => {
      if (!mountedRef.current) return;
      setCurrentText(text);
      setOpacity(1);
      await delay(FADE_DURATION + DISPLAY_MS);
      if (!mountedRef.current) return;
      setOpacity(0);
      await delay(FADE_DURATION);
      if (!mountedRef.current) return;
      setCurrentText(null);
    };

    const run = async () => {
      // 靠岸
      for (const line of set1) {
        if (!mountedRef.current || Date.now() - startTimeRef.current >= STAGE1_END) break;
        await showText(line);
        await delay(GAP_MS);
      }
      while (mountedRef.current && Date.now() - startTimeRef.current < STAGE1_END) await delay(1000);

      // 漂流
      for (const line of set2) {
        if (!mountedRef.current || Date.now() - startTimeRef.current >= STAGE2_END) break;
        await showText(line);
        await delay(GAP_MS);
      }
      while (mountedRef.current && Date.now() - startTimeRef.current < STAGE2_END) await delay(1000);

      // 悬浮 (无尽点点点)
      while (mountedRef.current) {
        await delay(15000 + Math.random() * 10000);
        await showText('...');
      }
    };

    run();
  }, []);

  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#000] selection:bg-zinc-800 selection:text-zinc-100">
      
      {/* 视觉降权退出按钮：左上角，极暗 */}
      <Link
        href="/v2"
        className="absolute left-8 top-10 z-20 text-[10px] tracking-[0.3em] text-zinc-800 uppercase outline-none transition-colors duration-1000 hover:text-zinc-500"
      >
        返回
      </Link>

      <div className="relative z-10 flex h-32 w-full max-w-lg flex-col items-center justify-center px-8">
        <div
          className="pointer-events-none flex w-full items-center justify-center text-center"
          style={{
            opacity,
            transitionProperty: 'opacity',
            transitionDuration: `${FADE_DURATION}ms`,
            transitionTimingFunction: 'ease-in-out',
          }}
        >
          <span className="text-[13px] font-light leading-loose tracking-[0.2em] text-zinc-500">
            {currentText}
          </span>
        </div>
      </div>
    </main>
  );
}