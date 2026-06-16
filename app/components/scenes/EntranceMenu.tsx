'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSpaceStore, Scene } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { track } from '../../lib/track';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../hooks/useLanguage';
import PlasticBag from '../PlasticBag';
import { supabase } from '../../lib/supabase';
import { isMirrorUnlocked } from '../../lib/personas';
import type { ShelterEntry } from '../../store/useShelterStore';

const HOME_SLOGAN_LINES = ['总会有个地方，', '留下一点痕迹。'];

function HomeExhibitLayer({ entries }: { entries: ShelterEntry[] }) {
  const fragments = useMemo(() => {
    return entries
      .filter((entry) => entry.status !== 'incinerated' && entry.content?.trim())
      .slice(0, 3)
      .map((entry) => {
        const content = entry.content.trim().replace(/\s+/g, ' ');
        return content.length > 18 ? `${content.slice(0, 18)}...` : content;
      });
  }, [entries]);

  const slots = [
    'left-[8%] top-[28%] rotate-[-2deg]',
    'right-[7%] top-[58%] rotate-[2deg]',
    'left-[13%] bottom-[16%] rotate-[1deg]',
  ];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-x-10 top-[116px] h-px bg-gradient-to-r from-transparent via-zinc-900/70 to-transparent" />
      <div className="absolute inset-x-14 bottom-[98px] h-px bg-gradient-to-r from-transparent via-zinc-900/70 to-transparent" />

      <div className="absolute left-[18%] top-[24%] hidden h-[46%] w-px bg-zinc-900/70 md:block" />
      <div className="absolute right-[18%] top-[24%] hidden h-[46%] w-px bg-zinc-900/70 md:block" />

      <div className="absolute left-1/2 top-[39%] h-px w-[min(48vw,250px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-zinc-900 to-transparent opacity-50" />
      <div className="absolute left-1/2 top-[66%] h-px w-[min(42vw,220px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-zinc-900 to-transparent opacity-40" />

      {fragments.map((fragment, index) => (
        <div
          key={`${fragment}-${index}`}
          className={`absolute hidden max-w-[126px] border-l border-zinc-800/50 pl-3 text-left font-mono text-[9px] leading-relaxed tracking-[0.18em] text-zinc-700/55 md:block ${slots[index]}`}
        >
          <span className="mb-2 block h-px w-6 bg-zinc-800/60" />
          {fragment}
        </div>
      ))}
    </div>
  );
}

function SponsorModule() {
  const [showQR, setShowQR] = useState(false);
  return (
    <div className="mt-10 flex flex-col items-center w-full pb-12">
      <button 
        onClick={() => setShowQR(!showQR)}
        className="text-zinc-700 hover:text-zinc-500 text-[10px] tracking-widest font-mono outline-none transition-colors"
      >
        &gt; 装着零钱的铁筐。
      </button>

      <AnimatePresence>
        {showQR && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center mt-6 overflow-hidden"
          >
            <div className="w-50 h-50 bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <span className="text-zinc-600 text-xs">
                <img src="/pay_code.png" alt="QR Code" className="w-full h-full object-contain" />
              </span>
            </div>
            <p className="mt-4 text-zinc-600 text-[10px] italic tracking-widest text-center">
              不提供 any 特权，只保证这里不会关门。
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EntranceMenu() {
  const setScene = useSpaceStore((state) => state.setScene);
  const addEntry = useShelterStore((state) => state.addEntry);
  const entries = useShelterStore((state) => state.entries);
  const lang = useLanguage();

  const mirrorUnlocked = useMemo(() => isMirrorUnlocked(entries), [entries]);

  const [isLifeInputActive, setIsLifeInputActive] = useState(false);
  const [lifeFragment, setLifeFragment] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [shopkeeperStatus, setShopkeeperStatus] = useState('');
  const [showMirrorToast, setShowMirrorToast] = useState(false);
  const [showGrowthHint, setShowGrowthHint] = useState(false);

  useEffect(() => {
    track('v3_entrance_view');
  }, []);

  useEffect(() => {
    const fetchShopkeeperStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('world_status')
          .select('value')
          .eq('key', 'shopkeeper_status')
          .single();

        if (!error && data?.value) {
          setShopkeeperStatus(data.value);
        }
      } catch (err) {
        console.error('获取店长状态失败:', err);
      }
    };
    fetchShopkeeperStatus();
  }, []);

  const handleSceneEnter = (targetScene: Scene) => {
    track('v3_scene_enter', { scene_name: targetScene });
    setScene(targetScene);
  };

  const handleShopkeeperTap = () => {
    track('SHOPKEEPER_CAPSULE_TAP');
    setScene('shopkeeper');
  };

  const submitLifeFragment = () => {
    if (!lifeFragment.trim()) return;

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

    setTimeout(() => setShowArchived(false), 2000);
  };

  const handleLifeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submitLifeFragment();
  };

  const secondaryOptions: { id: Scene; label: string; isNew?: boolean; className: string }[] = [
    { id: 'resting', label: '坐一会儿', className: 'col-span-2 justify-self-center' },
    { id: 'nostalgia', label: '看看我的痕迹', isNew: false, className: 'justify-self-end' },
    { id: 'roaming', label: '在店里走走', className: 'justify-self-start' },
  ];

  const handleMirrorTap = () => {
    if (mirrorUnlocked) {
      handleSceneEnter('mirror');
    } else {
      setShowMirrorToast(true);
      setTimeout(() => setShowMirrorToast(false), 2500);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-transparent select-none">
      <HomeExhibitLayer entries={entries} />
      
      <div className="absolute top-8 left-6 md:left-12 z-40 flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity duration-500">
        <img src="/logo.png" alt="End Here Logo" className="w-5 h-5 object-contain" />
        <span className="text-[11px] font-mono tracking-widest text-zinc-500">END HERE</span>
      </div>

      <PlasticBag />

      {/* 🟢 CDO: 环境光影重构区 */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-0 h-44 w-44 bg-[radial-gradient(circle_at_bottom_right,rgba(151,99,48,0.16),transparent_62%)]" />
      <div className="pointer-events-none absolute bottom-7 right-24 z-0 hidden h-10 w-10 rounded-full bg-amber-900/18 blur-2xl md:block" />
      
      {/* 🟢 CDO 新增：陈列馆全局底部微暖漏光 */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-32 w-[90vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(168,162,158,0.06),transparent_70%)] md:h-40 md:w-[60vw]" />

      <div className="absolute top-[58px] md:top-[60px] left-1/2 -translate-x-1/2 flex flex-col items-center z-40">
        <button
          onClick={handleShopkeeperTap}
          style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px' }}
          className="border border-zinc-800 bg-zinc-900/50 rounded-full flex items-center gap-4 transition-colors hover:bg-zinc-800/80 outline-none cursor-pointer"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse shrink-0" />
          <span className="text-zinc-300 text-[13px] tracking-[0.15em] font-mono leading-relaxed whitespace-nowrap">{shopkeeperStatus}</span>
        </button>
      </div>

      {/* 核心分诊台 */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-lg gap-10 pt-24 translate-y-8 md:translate-y-10">
        
        {/* 店长动态胶囊 */}
        <div className="flex flex-col items-center px-8 text-center">
          <h1 className="flex flex-col items-center gap-3 text-[21px] md:text-[27px] text-zinc-300 tracking-[0.12em] font-light leading-relaxed">
            {HOME_SLOGAN_LINES.map((line) => (
              <span key={line} className="whitespace-nowrap">
                {line}
              </span>
            ))}
          </h1>
        </div>

        {/* 主入口区：观点轨 vs 生活轨 */}
        <div className="flex flex-col items-center w-full gap-1 min-h-[120px]">
          
          <button
            onClick={() => handleSceneEnter('speaking')}
            className="group flex items-center justify-center gap-4 py-2 text-zinc-300 hover:text-zinc-50 transition-all duration-700 ease-out outline-none"
          >
            <span className="tracking-[0.15em] text-lg font-medium">
              [ 我有些话想说 ]
            </span>
          </button>

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
                <motion.div
                  key="input"
                  initial={{ opacity: 0, width: '0%' }} animate={{ opacity: 1, width: '100%' }} exit={{ opacity: 0 }}
                  className="w-full max-w-[280px] flex items-center gap-3 border-b border-zinc-800 focus-within:border-zinc-500 transition-colors"
                >
                  <input
                    autoFocus
                    type="text"
                    value={lifeFragment}
                    onChange={(e) => setLifeFragment(e.target.value)}
                    onKeyDown={handleLifeSubmit}
                    onBlur={() => !lifeFragment.trim() && setIsLifeInputActive(false)}
                    className="flex-1 bg-transparent text-zinc-300 text-[13px] tracking-[0.1em] text-center pb-2 outline-none placeholder:text-zinc-700/50"
                    placeholder="今天买了半个西瓜🍉"
                  />
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitLifeFragment}
                    disabled={!lifeFragment.trim()}
                    className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 text-[11px] tracking-widest font-mono pb-2 outline-none transition-colors shrink-0"
                  >
                    [ 放入 ]
                  </button>
                </motion.div>
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

        <div className="w-8 h-[1px] bg-zinc-800/80 mt-4" />

        {/* 辅助功能区 */}
        <div className="grid grid-cols-2 items-center gap-x-14 gap-y-9 w-full max-w-[320px] mt-2">
          {secondaryOptions.map((item) => (
            <div key={item.id} className={`relative flex items-center justify-center ${item.className}`}>
              <button
                onClick={() => handleSceneEnter(item.id)}
                className="tracking-[0.1em] text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors duration-700 ease-out outline-none"
              >
                {item.label}
              </button>
              
              {item.isNew && (
                <span className="absolute -right-8 -top-1.5 text-[8px] text-[#6b8e23] font-mono tracking-widest bg-[#6b8e23]/10 px-1 py-[1px] rounded-[2px] opacity-80 pointer-events-none">
                  NEW
                </span>
              )}
            </div>
          ))}

          <div className="relative col-span-2 flex flex-col items-center justify-self-center">
            <button
              onClick={handleMirrorTap}
              className={`tracking-[0.1em] text-[13px] transition-colors duration-700 ease-out outline-none ${
                mirrorUnlocked
                  ? 'text-zinc-600 hover:text-zinc-300'
                  : 'text-zinc-800 cursor-default'
              }`}
            >
              和过去的自己坐一会儿
            </button>

            <AnimatePresence>
              {showMirrorToast && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-full mt-3 text-[10px] text-zinc-600 tracking-[0.15em] font-mono whitespace-nowrap pointer-events-none"
                >
                  镜子需要更多痕迹合成
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 🟢 CDO & CMO 重构：极简的底层重组预告 */}
        <div className="relative z-10 mt-4 flex flex-col items-center gap-3">
          <button
            onClick={() => setShowGrowthHint((prev) => !prev)}
            className="text-[10px] tracking-[0.2em] text-zinc-700 transition-colors duration-700 hover:text-zinc-400 outline-none cursor-pointer"
          >
            [ 空间底部透出微光 ]
          </button>

          <AnimatePresence>
            {showGrowthHint && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: 5 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: 5 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex flex-col items-center border-l-2 border-zinc-800/60 pl-3">
                  <p className="font-mono text-[9px] leading-relaxed tracking-[0.15em] text-zinc-600/80 text-left">
                    EndHere店面升级中...
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <SponsorModule />
      </div>
      
    </div>
  );
}