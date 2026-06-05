'use client';

import { useState, useEffect } from 'react';
import { useSpaceStore, Scene } from '../../store/useSpaceStore';
import { track } from '../../lib/track';
import { useWorldSummary } from '../../hooks/useWorldSummary';
import { motion, AnimatePresence } from 'framer-motion';
import { useTraces } from '../../hooks/useTraces';

export default function EntranceMenu() {
  const setScene = useSpaceStore((state) => state.setScene);
  const envText = useWorldSummary();
  const traces = useTraces();

  // 新增：移动端触碰显影状态机
  const [activeTraceIdx, setActiveTraceIdx] = useState<number | null>(null);

  // 新增：4秒后自动消散的定时器
  useEffect(() => {
    if (activeTraceIdx === null) return;
    const timer = setTimeout(() => {
      setActiveTraceIdx(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [activeTraceIdx]);

  // 轮播状态机
  const [sentences, setSentences] = useState<string[]>(['...']);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 1. 基础视图埋点
  useEffect(() => {
    track('v3_entrance_view');
  }, []);

  // 2. 切割引擎：将大模型返回的长句切分为短句
  useEffect(() => {
    if (!envText || envText === '...') return;
    
    // 2. 切割引擎：仅按句号、问号、叹号切割，绝不破坏逗号连接的从句
    const parts = envText
      .split(/[。！？.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    if (parts.length > 0) {
      setSentences(parts);
      setCurrentIndex(0);
    }
  }, [envText]);

  // 3. 节拍器：5秒轮播机制
  useEffect(() => {
    if (sentences.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sentences.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [sentences.length]);

  // 4. 路由拦截与交互埋点
  const handleSceneEnter = (targetScene: Scene) => {
    track('v3_scene_enter', { scene_name: targetScene });
    setScene(targetScene);
  };

  const handleEnvInteract = (text: string) => {
    track('v3_env_interact', { target_text: text });
    // TODO: 等待 CPO 交互决策，目前仅做打印
    console.log('观测实体:', text);
  };

  const secondaryOptions: { id: Scene; label: string }[] = [
    { id: 'resting', label: '我只是有点累' },
    { id: 'nostalgia', label: '我想起了一些以前的事' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-transparent select-none">
      
      {/* 动态呼吸底噪 */}
      <div className="absolute top-12 w-full h-8 flex items-center justify-center text-[12px] text-zinc-700/60 tracking-[0.2em] font-mono z-20">
        <AnimatePresence mode="wait">
          <motion.button
            key={currentIndex}
            initial={{ opacity: 0, filter: 'blur(2px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(2px)' }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            onClick={() => handleEnvInteract(sentences[currentIndex])}
            className="hover:text-zinc-300 transition-colors duration-500 outline-none cursor-pointer"
          >
            [ {sentences[currentIndex]} ]
          </motion.button>
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center justify-center w-full max-w-lg gap-20">
        
        <div className="flex flex-col items-center gap-5">
          <h2 className="text-sm md:text-base text-zinc-600 tracking-[0.3em] font-light">
            欢迎光临。
          </h2>
          <h1 className="text-2xl md:text-3xl text-zinc-300 tracking-[0.1em] font-medium">
            今天过得怎么样？
          </h1>
        </div>

        <div className="flex flex-col items-center w-full gap-12">
          
          <button
            onClick={() => handleSceneEnter('speaking')}
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

          <div className="w-8 h-[1px] bg-zinc-800/80" />

          <div className="flex flex-col items-center gap-8 w-full">
            {secondaryOptions.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSceneEnter(item.id)}
                className="tracking-[0.1em] text-[15px] text-zinc-500 hover:text-zinc-200 transition-colors duration-700 ease-out outline-none"
              >
                {item.label}
              </button>
            ))}
          </div>

        </div>
      </div>
      {/* 极简痕迹陈列区：完全适配移动端触碰交互 */}
      {traces.length > 0 && (
        <div className="absolute bottom-10 w-full flex flex-wrap justify-center gap-6 px-6 z-20">
          {traces.map((item, idx) => {
            const isActive = activeTraceIdx === idx;
            
            return (
              <div key={idx} className="relative flex flex-col items-center justify-center">
                
                {/* 细节描述：触碰后淡入，上方浮现 */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 2 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute bottom-full mb-3 w-max max-w-[240px] text-center z-30 pointer-events-none"
                    >
                      <span className="inline-block text-zinc-500 text-[10px] tracking-widest font-light leading-relaxed">
                        {item.desc}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 物品本体：改为可点击的 button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // 点击切换，如果点自己则关闭
                    setActiveTraceIdx(isActive ? null : idx);
                    // 埋点：记录用户触摸了哪个痕迹
                    track('v3_trace_tap', { item_name: item.name });
                  }}
                  className={`text-[11px] tracking-[0.2em] font-mono transition-colors duration-700 outline-none ${
                    isActive ? 'text-zinc-400' : 'text-zinc-700/40 hover:text-zinc-500'
                  }`}
                >
                  {item.name}
                </button>
                
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}