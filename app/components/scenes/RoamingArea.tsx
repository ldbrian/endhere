'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpaceStore } from '../../store/useSpaceStore';

export default function RoamingArea() {
  const [mounted, setMounted] = useState(false);
  const lang = useLanguage();
  const setScene = useSpaceStore((state) => state.setScene);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-full bg-[#030303] flex flex-col items-center justify-center select-none overflow-hidden font-mono">
      <button
        onClick={() => setScene('entrance')}
        className="absolute top-12 left-6 md:left-12 tracking-[0.2em] text-[13px] text-zinc-500 opacity-30 hover:opacity-100 hover:text-zinc-300 transition-all duration-1000 outline-none z-20"
      >
         {lang.HOME.back} 
      </button>
      {/* 墙壁：模拟风化文字散点排版 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <span className="absolute top-[20%] left-[15%] text-zinc-600/30 font-light text-[11px] tracking-[0.2em]">有人在这里发呆很久</span>
        <span className="absolute top-[70%] left-[60%] text-zinc-700/10 font-thin text-[12px] tracking-[0.2em]">有人烧掉了一张小票</span>
        <span className="absolute top-[40%] left-[80%] text-zinc-500/20 font-extralight text-[10px] tracking-[0.2em]">......</span>
      </div>

      {/* 核心中轴线交互区 */}
      <div className="relative z-10 flex flex-col items-center gap-24 w-full max-w-md px-6">
        
        {/* 铁筐 */}
        <div className="text-center">
          <p className="text-zinc-300 text-[12px] tracking-[0.2em]">
            [ 铁筐：一颗放了 32 小时的薄荷糖 ]
          </p>
        </div>

        {/* 木凳 */}
        <button 
          className="text-[#a09070]/80 text-[12px] tracking-[0.2em] outline-none cursor-pointer hover:text-white transition-colors"
        >
          [ 木凳边缘还有一点余温。 ]
        </button>

      </div>
    </div>
  );
}