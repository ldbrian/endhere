'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function V2PlasticBag() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    window.setTimeout(() => setIsFlipped(false), 300);
  };

  const expanded = mounted && isOpen
    ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/96">
          <div className="absolute inset-0 cursor-pointer" onClick={handleClose} />
          <div
            className="relative z-10 flex h-[380px] w-[280px] flex-col items-center justify-center transition-transform duration-700 ease-in-out"
            style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transformStyle: 'preserve-3d' }}
            onClick={(event) => event.stopPropagation()}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 280 380" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 20 20 L 60 20 L 60 90 Q 140 130 220 90 L 220 20 L 260 20 L 270 360 Q 270 370 260 370 L 20 370 Q 10 370 10 360 Z" stroke="#3f3f46" strokeWidth="1" />
              <path d="M 30 370 L 30 110" stroke="#3f3f46" strokeWidth="1" strokeDasharray="2 4" opacity="0.4" />
              <path d="M 250 370 L 250 110" stroke="#3f3f46" strokeWidth="1" strokeDasharray="2 4" opacity="0.4" />
            </svg>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8"
              style={{ opacity: isFlipped ? 0 : 1, pointerEvents: isFlipped ? 'none' : 'auto', transition: 'opacity 0.4s ease-in-out' }}
            >
              <div className="mt-8 flex flex-1 flex-col items-center justify-center space-y-4">
                <p className="pt-6 font-mono text-[24px] tracking-[0.3em] text-zinc-700">END HERE</p>
                <p className="text-xl font-light tracking-[0.3em] text-zinc-300">{'\u574f\u60c5\u7eea'}</p>
                <p className="text-sm font-light tracking-[0.4em] text-zinc-500">{'\u7981\u6b62\u5916\u5e26'}</p>
                <p className="text-[10px] font-light tracking-[0.4em] text-zinc-500">{'\u65ad\u7f51\u888b 404 \u53f7'}</p>
              </div>
              <button
                onClick={() => setIsFlipped(true)}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 text-[11px] tracking-widest text-zinc-600 transition-colors hover:text-zinc-300 outline-none"
              >
                {'[ \u7ffb\u9762\u67e5\u770b ]'}
              </button>
            </div>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8"
              style={{ opacity: isFlipped ? 1 : 0, pointerEvents: isFlipped ? 'auto' : 'none', transform: 'rotateY(180deg)', transition: 'opacity 0.4s ease-in-out' }}
            >
              <div className="mt-6 flex flex-1 flex-col justify-center space-y-6 text-center text-[11px] font-light leading-loose tracking-widest text-zinc-400">
                <p className="inline-block border-b border-zinc-800 px-2 pb-2 text-zinc-300">/ {'\u79bb\u7ebf\u907f\u96be\u6240'} /</p>
                <div className="space-y-1">
                  <p className="text-zinc-300">iOS</p>
                  <p className="text-[10px] text-zinc-600">{'\u70b9\u51fb\u5e95\u90e8 [\u5206\u4eab] -> [\u6dfb\u52a0\u5230\u4e3b\u5c4f\u5e55]'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-300">Android</p>
                  <p className="text-[10px] text-zinc-600">{'\u70b9\u51fb\u53f3\u4e0a\u89d2\u83dc\u5355 -> [\u5b89\u88c5\u5e94\u7528]'}</p>
                </div>
              </div>
              <div className="fixed bottom-8 flex w-full justify-center gap-12">
                <button onClick={() => setIsFlipped(false)} className="text-[11px] tracking-widest text-zinc-600 transition-colors hover:text-zinc-300 outline-none">
                  {'[ \u7ffb\u56de\u6b63\u9762 ]'}
                </button>
                <button onClick={handleClose} className="text-[11px] tracking-widest text-zinc-700 transition-colors hover:text-red-900/60 outline-none">
                  {'[ \u6536\u8d77\u6765 ]'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative z-10 text-zinc-600 transition-colors duration-500 hover:text-zinc-300 outline-none"
          aria-label="Open plastic bag"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4 L8 4 L8 10 C8 12 16 12 16 10 L16 4 L20 4 L21 20 C21 21 20 22 19 22 L5 22 C4 22 3 21 3 20 Z" />
            <path d="M8 4 L8 2 M16 4 L16 2" opacity="0.3" />
          </svg>
        </button>
      )}
      {expanded}
    </>
  );
}
