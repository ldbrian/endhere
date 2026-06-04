'use client';

import { useState, useEffect } from 'react';
import { useSpaceStore, Scene } from '../../store/useSpaceStore';

export default function EntranceMenu() {
  const setScene = useSpaceStore((state) => state.setScene);
  const [envText, setEnvText] = useState('...');

  useEffect(() => {
    const texts = [
      '收音机里有人在念天气预报。',
      'Ash 正在后面整理货架。',
      '门外刚刚有辆公交车经过。',
      '制冷机发出微弱的嗡嗡声。',
      '角落里的植物叶片微微晃动。'
    ];
    setEnvText(texts[Math.floor(Math.random() * texts.length)]);
  }, []);

  const secondaryOptions: { id: Scene; label: string }[] = [
    { id: 'trashing', label: '我很烦（施工中）' },
    { id: 'resting', label: '我只是有点累' },
    { id: 'nostalgia', label: '我想起了一些以前的事' },
    { id: 'browsing', label: '没什么，只是进来看看（施工中）' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-transparent select-none">
      
      {/* 顶部环境底噪 */}
      <div className="absolute top-12 w-full text-center text-[12px] text-zinc-700/60 tracking-[0.2em] font-mono">
        [ {envText} ]
      </div>

      {/* 
        核心容器：使用 gap-20 (80px的绝对间距) 
        强行将“标题区”和“选项区”撕开 
      */}
      <div className="flex flex-col items-center justify-center w-full max-w-lg gap-20">
        
        {/* ==========================================
            标题区
            使用 gap-5 (20px) 隔开小标题和大标题
            ========================================== */}
        <div className="flex flex-col items-center gap-5">
          <h2 className="text-sm md:text-base text-zinc-600 tracking-[0.3em] font-light">
            欢迎光临。
          </h2>
          <h1 className="text-2xl md:text-3xl text-zinc-300 tracking-[0.1em] font-medium">
            今天过得怎么样？
          </h1>
        </div>

        {/* ==========================================
            选项区
            使用 gap-12 (48px) 隔开主选项、分割线和次选项
            ========================================== */}
        <div className="flex flex-col items-center w-full gap-12">
          
          {/* 主入口：废弃全宽和绝对定位，让括号优雅地拥抱文字 */}
          <button
            onClick={() => setScene('speaking')}
            className="group flex items-center justify-center gap-4 py-2 text-zinc-300 hover:text-zinc-50 transition-all duration-700 ease-out outline-none"
          >
            <span className="opacity-40 group-hover:opacity-100 transition-opacity duration-700 font-light text-xl">
              [
            </span>
            <span className="tracking-[0.15em] text-lg font-medium">
              我有很多话想说
            </span>
            <span className="opacity-40 group-hover:opacity-100 transition-opacity duration-700 font-light text-xl">
              ]
            </span>
          </button>

          {/* 视觉分割线 */}
          <div className="w-8 h-[1px] bg-zinc-800/80" />

          {/* 次级入口：使用 gap-8 (32px) 强行拉开每个选项的呼吸空间 */}
          <div className="flex flex-col items-center gap-8 w-full">
            {secondaryOptions.map((item) => (
              <button
                key={item.id}
                onClick={() => setScene(item.id)}
                className="tracking-[0.1em] text-[15px] text-zinc-500 hover:text-zinc-200 transition-colors duration-700 ease-out outline-none"
              >
                {item.label}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}