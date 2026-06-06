'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function PlasticBag() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setIsFlipped(false), 300); 
  };

  const ClosedState = () => (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed top-8 right-6 md:right-12 z-40 text-zinc-600 hover:text-zinc-300 transition-colors duration-500 outline-none"
      aria-label="打开塑料袋"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4 L8 4 L8 10 C8 12 16 12 16 10 L16 4 L20 4 L21 20 C21 21 20 22 19 22 L5 22 C4 22 3 21 3 20 Z" />
        <path d="M8 4 L8 2 M16 4 L16 2" opacity="0.3" />
      </svg>
    </button>
  );

  const ExpandedState = () => {
    if (!mounted) return null;

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90">
        
        <div className="absolute inset-0 cursor-pointer" onClick={handleClose} />

        <div 
          className="relative z-10 w-[280px] h-[380px] flex flex-col items-center justify-center transition-transform duration-700 ease-in-out"
          style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transformStyle: 'preserve-3d' }}
          onClick={(e) => e.stopPropagation()} 
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 280 380" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 20 20 L 60 20 L 60 90 Q 140 130 220 90 L 220 20 L 260 20 L 270 360 Q 270 370 260 370 L 20 370 Q 10 370 10 360 Z" stroke="#3f3f46" strokeWidth="1" />
            <path d="M 30 370 L 30 110" stroke="#3f3f46" strokeWidth="1" strokeDasharray="2 4" opacity="0.4" />
            <path d="M 250 370 L 250 110" stroke="#3f3f46" strokeWidth="1" strokeDasharray="2 4" opacity="0.4" />
          </svg>

          {/* ========== 正面 ========== */}
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center p-8"
            style={{ 
              opacity: isFlipped ? 0 : 1, 
              pointerEvents: isFlipped ? 'none' : 'auto',
              transition: 'opacity 0.4s ease-in-out' 
            }}
          >
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 mt-8">
              <p className="text-xl tracking-[0.3em] text-zinc-300 font-light">坏情绪</p>
              <p className="text-sm tracking-[0.4em] text-zinc-500 font-light">禁止外带</p>
              <p className="text-[10px] tracking-[0.3em] text-zinc-700 font-mono pt-6">END HERE</p>
            </div>

            {/* 🟢 修改点：pb-6 改为 pb-12，把按钮往上顶 */}
            <div className="mt-auto pb-12">
              <button
                onClick={() => setIsFlipped(true)}
                className="fixed bottom-8 left-1/2 transform -translate-x-1/2 text-[11px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors outline-none"
              >
                [ 翻面查看 ]
              </button>
            </div>
          </div>

          {/* ========== 背面 ========== */}
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center p-8"
            style={{ 
              opacity: isFlipped ? 1 : 0, 
              pointerEvents: isFlipped ? 'auto' : 'none',
              transform: 'rotateY(180deg)', 
              transition: 'opacity 0.4s ease-in-out' 
            }}
          >
            <div className="flex-1 flex flex-col justify-center w-full space-y-6 text-[11px] tracking-widest text-zinc-400 font-light leading-loose text-center mt-6">
              <div>
                <p className="text-zinc-300 border-b border-zinc-800 pb-2 inline-block px-2">/ 离线避难所 /</p>
              </div>
              <div className="space-y-1">
                <p className="text-zinc-300">iOS 用户</p>
                <p className="text-zinc-600 text-[10px]">点击底部 [分享] -{'>'} [添加到主屏幕]</p>
              </div>
              <div className="space-y-1">
                <p className="text-zinc-300">Android 用户</p>
                <p className="text-zinc-600 text-[10px]">点击右上角菜单 -{'>'} [安装应用]</p>
              </div>
            </div>

            {/* 🟢 修改点：pb-6 改为 pb-12，把按钮往上顶 */}
            <div className="mt-auto flex w-full justify-center gap-12 pb-12">
              <button
                onClick={() => setIsFlipped(false)}
                className="fixed bottom-8 left-1/3 transform -translate-x-1/2 text-[11px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors outline-none"
              >
                [ 翻回正面 ]
              </button>
              <button
                onClick={handleClose}
                className="fixed bottom-8 left-2/3 transform -translate-x-1/2 text-[11px] tracking-widest text-zinc-700 hover:text-red-900/60 transition-colors outline-none"
              >
                [ 收起来 ]
              </button>
            </div>
          </div>

        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {!isOpen && <ClosedState />}
      {isOpen && <ExpandedState />}
    </>
  );
}