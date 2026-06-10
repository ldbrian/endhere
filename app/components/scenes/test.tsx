'use client';

import { useState, useEffect } from 'react';
import { useSpaceStore, Scene } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { track } from '../../lib/track';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../hooks/useLanguage';
import PlasticBag from '../PlasticBag';

export default function EntranceMenu() {
  const setScene = useSpaceStore((state) => state.setScene);
  const addEntry = useShelterStore((state) => state.addEntry);
  const lang = useLanguage();

  // 生活轨独立状态
  const [isLifeInputActive, setIsLifeInputActive] = useState(false);
  const [lifeFragment, setLifeFragment] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    // 🟢 统一由 lib/track.ts 内部自动计算匿名指纹及新老用户防抖计数
    // 业务组件实现彻底的无感知调用
    track('v3_entrance_view');
  }, []);

  const handleSceneEnter = (targetScene: Scene) => {
    track('v3_scene_enter', { scene_name: targetScene });
    setScene(targetScene);
  };

  // 🟢 提交生活碎片 (静默落库)
  const handleLifeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && lifeFragment.trim()) {
      // 🟢 触发生活碎片字典埋点
      track('SUBMIT_LIFE_SLICE', { length: lifeFragment.trim().length });

      addEntry({
        id: crypto.randomUUID(),
        receiptId: `LIFE-${Date.now().toString().slice(-6)}`,
        timestamp: Date.now(),
        content: lifeFragment.trim(),
        persona: 'User',
        type: 'life_fragment',
        status: 'normal'
      });
      setLifeFragment('');
      setIsLifeInputActive(false);
      setShowArchived(true);
      
      // 短促归档提示，2秒后恢复原状
      setTimeout(() => setShowArchived(false), 2000);
    }
  };

  const secondaryOptions: { id: Scene; label: string }[] = [
    { id: 'resting', label: lang.HOME.tired },
    { id: 'nostalgia', label: lang.HOME.nostalgia },
    { id: 'roaming', label: lang.HOME.roaming },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-transparent select-none">
      
      <div className="absolute top-8 left-6 md:left-12 z-40 flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity duration-500">
        <img src="/logo.png" alt="End Here Logo" className="w-5 h-5 object-contain" />
        <span className="text-[11px] font-mono tracking-widest text-zinc-500">END HERE</span>
      </div>

      <PlasticBag />

      {/* 核心分诊台 */}
      <div className="flex flex-col items-center justify-center w-full max-w-lg gap-16 mt-10">
        
        <div className="flex flex-col items-center gap-5">
          <h2 className="text-sm md:text-base text-zinc-600 tracking-[0.3em] font-light">
            {lang.HOME.welcome}
          </h2>
          <h1 className="text-2xl md:text-3xl text-zinc-300 tracking-[0.1em] font-medium">
            {lang.HOME.prompt}
          </h1>
        </div>

        {/* 主入口区：观点轨 vs 生活轨 */}
        <div className="flex flex-col items-center w-full gap-8 min-h-[120px]">
          
          {/* 入口 A：观点轨 (深度倾诉) */}
          <button
            onClick={() => handleSceneEnter('speaking')}
            className="group flex items-center justify-center gap-4 py-2 text-zinc-300 hover:text-zinc-50 transition-all duration-700 ease-out outline-none"
          >
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-700 font-light text-xl">[</span>
            <span className="tracking-[0.15em] text-lg font-medium">
              [ 我有很多话想说 ]
            </span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-700 font-light text-xl">]</span>
          </button>

          {/* 入口 B：生活轨 (碎片归档) */}
          <div className="w-full flex justify-center items-center h-12">
            <AnimatePresence mode="wait">
              {showArchived ? (
                <motion.p 
                  key="archived"
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-zinc-500 text-sm tracking-[0.3em] font-light"
                >
                  [ 已归档 ]
                </motion.p>
              ) : isLifeInputActive ? (
                <motion.input 
                  key="input"
                  initial={{ opacity: 0, width: '0%' }} animate={{ opacity: 1, width: '100%' }} exit={{ opacity: 0 }}
                  autoFocus
                  type="text" 
                  value={lifeFragment}
                  onChange={(e) => setLifeFragment(e.target.value)}
                  onKeyDown={handleLifeSubmit}
                  onBlur={() => !lifeFragment.trim() && setIsLifeInputActive(false)} // 失去焦点且为空时还原
                  className="w-full max-w-[280px] bg-transparent border-b border-zinc-800 text-zinc-300 text-[13px] tracking-[0.1em] text-center pb-2 outline-none placeholder:text-zinc-700/50 focus:border-zinc-500"
                  placeholder="无需意义，哪怕只是喝了一杯水。"
                />
              ) : (
                <motion.button
                  key="btn"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setIsLifeInputActive(true)}
                  className="tracking-[0.15em] text-zinc-500 hover:text-zinc-300 text-sm font-light transition-colors duration-500 outline-none"
                >
                  [ 留下一块生活碎片 ]
                </motion.button>
              )}
            </AnimatePresence>
          </div>

        </div>

        <div className="w-8 h-[1px] bg-zinc-800/80" />

        {/* 辅助功能区 */}
        <div className="flex flex-col items-center gap-8 w-full">
          {secondaryOptions.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSceneEnter(item.id)}
              className="tracking-[0.1em] text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors duration-700 ease-out outline-none"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}