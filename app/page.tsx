'use client';

import { useSpaceStore } from './store/useSpaceStore';
//import AmbientLayer from './components/AmbientLayer'; // 你的静置底噪引擎组件
import EntranceMenu from './components/scenes/EntranceMenu';
import SpeakingScene from './components/scenes/SpeakingScene';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import RestingScene from './components/scenes/RestingScene';
import NostalgiaScene from './components/scenes/NostalgiaScene';
import RoamingArea from './components/scenes/RoamingArea';
import IncineratorScene from './components/scenes/IncineratorScene'; // 🟢 新增引入焚烧区
import MirrorScene from './components/scenes/MirrorScene'; // 🟢 新增引入镜子角色场景
import ShopkeeperScene from './components/scenes/ShopkeeperScene'; // 🟢 新增引入店长痕迹页
// 待引入的其他组件...
// import GuestbookArea from '@/components/scenes/GuestbookArea';
// import TrashBinArea from '@/components/scenes/TrashBinArea';
// import WindowBenchArea from '@/components/scenes/WindowBenchArea';
// import OldDrawerArea from '@/components/scenes/OldDrawerArea';
// import BasketArea from '@/components/scenes/BasketArea';

export default function EndHereSpace() {
  const currentScene = useSpaceStore((state) => state.currentScene);

  // 视觉规范：极其克制的淡入淡出与微弱的失焦溶解 (duration: 1s)
  const fadeVariants: Variants = {
    initial: { opacity: 0, filter: 'blur(4px)' },
    animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 1, ease: 'easeOut' } },
    exit: { opacity: 0, filter: 'blur(4px)', transition: { duration: 1, ease: 'easeIn' } }
  };

  

  return (
    <main className="relative w-full h-screen bg-[#0C0C0C] text-zinc-400 overflow-hidden font-mono selection:bg-zinc-800 selection:text-zinc-200">
      {/* 永远运行在底层的环境底噪层，不受场景切换影响 */}
      {/* <AmbientLayer />  */}
      
      {/* 核心场景平滑切换区 */}
      <div className="absolute inset-0 z-10">
        <AnimatePresence mode="wait">
          {currentScene === 'entrance' && (
            <motion.div key="entrance" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full">
              <EntranceMenu />
            </motion.div>
          )}
          
          {/* 后续场景预留位 */}
          {currentScene === 'speaking' && (
            <motion.div key="speaking" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full">
              <SpeakingScene />
            </motion.div>
          )}
          {/* {currentScene === 'trashing' && <motion.div key="trashing" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full"><TrashBinArea /></motion.div>} */}
          {currentScene === 'resting' && <motion.div key="resting" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full"><RestingScene /></motion.div>} 
          {currentScene === 'nostalgia' && <motion.div key="nostalgia" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full"><NostalgiaScene /></motion.div>} 
          {currentScene === 'roaming' && <motion.div key="roaming" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full"><RoamingArea /></motion.div>}
          {/* 🟢 新增焚烧区路由映射 */}
          {currentScene === 'incinerator' && <motion.div key="incinerator" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full"><IncineratorScene /></motion.div>}
          {/* 🟢 新增镜子场景路由映射 */}
          {currentScene === 'mirror' && <motion.div key="mirror" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full"><MirrorScene /></motion.div>}
          {/* 🟢 新增店长痕迹页路由映射 */}
          {currentScene === 'shopkeeper' && <motion.div key="shopkeeper" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full"><ShopkeeperScene /></motion.div>}
        </AnimatePresence>
      </div>
    </main>
  );
}