import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useTimeAccumulator } from '../../hooks/useTimeAccumulator';
import { track } from '../../lib/track'; // <-- 引入原生探针

export default function RestingScene() {
  const setScene = useSpaceStore((state) => state.setScene);
  const accumulatedTime = useTimeAccumulator();
  
  // 3. 织入：静默记录时长 (不干扰现有的环境文本逻辑)
  const enterTimeRef = useRef<number>(0);
  useEffect(() => {
    enterTimeRef.current = Date.now();
    return () => {
      if (enterTimeRef.current > 0) {
        const timeSpent = Math.floor((Date.now() - enterTimeRef.current) / 1000);
        track('v3_resting_duration', { duration_seconds: timeSpent });
      }
    };
  }, []);
  // ==========================================
  // 状态机：序章 -> 环境白描 -> 通感反馈
  // ==========================================
  const [isIntro, setIsIntro] = useState(true);
  const [introVisible, setIntroVisible] = useState(false);

  const [ambientText, setAmbientText] = useState('');
  const [isAmbientVisible, setIsAmbientVisible] = useState(false);

  const [filterColor, setFilterColor] = useState('bg-transparent');
  const [synesthesiaText, setSynesthesiaText] = useState('');
  
  const [isMintConsumed, setIsMintConsumed] = useState(false);
  const [isOrangeConsumed, setIsOrangeConsumed] = useState(false);

  // 1. 序章引擎：入场时的代入感文案
  useEffect(() => {
    setIntroVisible(true);
    
    const fadeOutTimer = setTimeout(() => {
      setIntroVisible(false);
    }, 4000);

    const endIntroTimer = setTimeout(() => {
      setIsIntro(false);
    }, 7000);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(endIntroTimer);
    };
  }, []);

  // 2. 环境呼吸引擎：加入“现实锚点”
  useEffect(() => {
    if (isIntro) return;

    const hour = new Date().getHours();
    let noiseArray: string[] = [];

    // CDO 重构：废除绝对纯黑，引入极度克制的“拉回现实”休止符
    if (hour >= 6 && hour < 17) {
      noiseArray = [
        '灰尘在从窗外透进来的光柱里翻滚。', 
        '外面偶尔有车经过的声音。', 
        '木凳有一点轻微的嘎吱声。', 
        '...外面的世界还在继续。' // 现实锚点
      ];
    } else if (hour >= 17 && hour < 20) {
      noiseArray = [
        '外面在下雨。木凳有点潮湿。', 
        '夕阳的光斑在吧台上缓慢移动。', 
        '能听到屋檐滴水的空灵声。', 
        '...天快黑了，该回去了。' // 现实锚点
      ];
    } else {
      noiseArray = [
        '除了冰箱压缩机的低鸣，这里什么声音都没有。', 
        '能听到自己微弱的呼吸声。', 
        '窗外的夜色像深海一样沉。', 
        '...夜深了。去睡吧。' // 现实锚点
      ];
    }

    let currentIndex = 0;
    setAmbientText(noiseArray[0]);
    setIsAmbientVisible(true);

    const cycle = () => {
      setIsAmbientVisible(false); // 触发淡出
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % noiseArray.length;
        setAmbientText(noiseArray[currentIndex]);
        setIsAmbientVisible(true); // 切换后淡入
      }, 5000); 
    };

    const timer = setInterval(cycle, 15000);
    return () => clearInterval(timer);
  }, [isIntro]);

  // 3. 通感交互引擎
  const handleConsume = (type: 'mint' | 'orange') => {
    if (type === 'mint') {
      setIsMintConsumed(true);
      setSynesthesiaText('[ 你剥开吃掉了它。喉咙里泛起一丝微弱的凉意。 ]');
      setFilterColor('bg-cyan-900/10');
    } else {
      setIsOrangeConsumed(true);
      setSynesthesiaText('[ 橘子有点干瘪，但汁水带着一丝微酸的暖意。 ]');
      setFilterColor('bg-orange-800/10');
    }

    setTimeout(() => {
      setSynesthesiaText('');
      setFilterColor('bg-transparent');
    }, 8000);
  };

  const showMint = accumulatedTime > 300 && !isMintConsumed && !synesthesiaText;
  const showOrange = accumulatedTime > 900 && !isOrangeConsumed && !synesthesiaText;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, ease: 'easeInOut' }}
      className="relative w-full h-full flex flex-col items-center justify-center bg-transparent select-none overflow-hidden"
    >
      <div 
        className={`absolute inset-0 pointer-events-none transition-colors duration-[5000ms] ease-in-out z-0 ${filterColor}`} 
      />

      <button
        onClick={() => setScene('entrance')}
        className="absolute top-12 left-6 md:left-12 tracking-[0.2em] text-[13px] text-zinc-500 opacity-30 hover:opacity-100 hover:text-zinc-300 transition-all duration-1000 outline-none z-20"
      >
        [ 退回门厅 ]
      </button>

      <div className="relative flex flex-col items-center justify-center px-6 w-full max-w-xl h-32 z-10">
        <AnimatePresence mode="wait">
          {synesthesiaText ? (
            <motion.p
              key="synesthesia"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="text-zinc-300 text-base md:text-lg tracking-[0.2em] font-light leading-relaxed text-center"
            >
              {synesthesiaText}
            </motion.p>
          ) : isIntro ? (
            <motion.p
              key="intro"
              initial={{ opacity: 0, filter: 'blur(8px)' }}
              animate={{ 
                opacity: introVisible ? 1 : 0, 
                filter: introVisible ? 'blur(0px)' : 'blur(8px)' 
              }}
              transition={{ duration: 3, ease: 'easeInOut' }}
              className="text-zinc-400 text-sm md:text-base tracking-[0.2em] font-light leading-relaxed text-center"
            >
              [ 你在角落的木凳上坐了下来。 ]
            </motion.p>
          ) : (
            <motion.p
              key="ambient"
              initial={{ opacity: 0, filter: 'blur(8px)' }}
              animate={{ 
                opacity: isAmbientVisible && ambientText ? 1 : 0, 
                filter: isAmbientVisible && ambientText ? 'blur(0px)' : 'blur(8px)' 
              }}
              transition={{ duration: 3, ease: 'easeInOut' }}
              className="text-zinc-500 text-sm md:text-base tracking-[0.2em] font-light leading-relaxed text-center"
            >
              {/* CDO 微调：去掉休止符外的括号，使其更像心底的声音 */}
              {ambientText.startsWith('...') ? ambientText : `[ ${ambientText} ]`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-32 flex flex-col items-center justify-center h-16 gap-6 z-10">
        <AnimatePresence>
          {showMint && (
            <motion.button
              key="mint-candy"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 3 }}
              onClick={() => handleConsume('mint')}
              className="text-zinc-500 opacity-40 hover:opacity-100 hover:text-cyan-200 text-xs md:text-sm tracking-[0.2em] font-light transition-all duration-1000 outline-none cursor-pointer"
            >
              [ 吧台边缘有一颗薄荷糖。 ]
            </motion.button>
          )}

          {showOrange && (
            <motion.button
              key="half-orange"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 3 }}
              onClick={() => handleConsume('orange')}
              className="text-zinc-500 opacity-40 hover:opacity-100 hover:text-orange-200 text-xs md:text-sm tracking-[0.2em] font-light transition-all duration-1000 outline-none cursor-pointer"
            >
              [ 角落里放着半只干瘪的橘子。 ]
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}