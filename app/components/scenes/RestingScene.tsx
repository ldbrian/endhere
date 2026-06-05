'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useTimeAccumulator } from '../../hooks/useTimeAccumulator';
import { track } from '../../lib/track';
import { useLanguage } from '../../hooks/useLanguage';

export default function RestingScene() {
  const lang = useLanguage();
  const setScene = useSpaceStore((state) => state.setScene);
  const accumulatedTime = useTimeAccumulator();
  
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

  const [isIntro, setIsIntro] = useState(true);
  const [introVisible, setIntroVisible] = useState(false);
  const [ambientText, setAmbientText] = useState('');
  const [isAmbientVisible, setIsAmbientVisible] = useState(false);
  const [filterColor, setFilterColor] = useState('bg-transparent');
  const [synesthesiaText, setSynesthesiaText] = useState('');
  const [isMintConsumed, setIsMintConsumed] = useState(false);
  const [isOrangeConsumed, setIsOrangeConsumed] = useState(false);

  useEffect(() => {
    setIntroVisible(true);
    const fadeOutTimer = setTimeout(() => setIntroVisible(false), 4000);
    const endIntroTimer = setTimeout(() => setIsIntro(false), 7000);
    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(endIntroTimer);
    };
  }, []);

  useEffect(() => {
    if (isIntro) return;
    const noiseArray = lang.RESTING.noises;
    let currentIndex = 0;
    setAmbientText(noiseArray[0]);
    setIsAmbientVisible(true);

    const cycle = () => {
      setIsAmbientVisible(false);
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % noiseArray.length;
        setAmbientText(noiseArray[currentIndex]);
        setIsAmbientVisible(true);
      }, 5000); 
    };

    const timer = setInterval(cycle, 15000);
    return () => clearInterval(timer);
  }, [isIntro, lang.RESTING.noises]);

  const handleConsume = (type: 'mint' | 'orange') => {
    if (type === 'mint') {
      setIsMintConsumed(true);
      setSynesthesiaText(`[ ${lang.RESTING.consumeMint} ]`); // 修正：移除多余大括号
      setFilterColor('bg-cyan-900/10');
    } else {
      setIsOrangeConsumed(true);
      setSynesthesiaText(`[ ${lang.RESTING.consumeOrange} ]`); // 修正：移除多余大括号
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
      <div className={`absolute inset-0 pointer-events-none transition-colors duration-[5000ms] ease-in-out z-0 ${filterColor}`} />

      <button
        onClick={() => setScene('entrance')}
        className="absolute top-12 left-6 md:left-12 tracking-[0.2em] text-[13px] text-zinc-500 opacity-30 hover:opacity-100 hover:text-zinc-300 transition-all duration-1000 outline-none z-20"
      >
        [ {lang.HOME.back} ]
      </button>

      <div className="relative flex flex-col items-center justify-center px-6 w-full max-w-xl h-32 z-10">
        <AnimatePresence mode="wait">
          {synesthesiaText ? (
            <motion.p key="synesthesia" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 2, ease: 'easeOut' }} className="text-zinc-300 text-base md:text-lg tracking-[0.2em] font-light leading-relaxed text-center">
              {synesthesiaText}
            </motion.p>
          ) : isIntro ? (
            <motion.p key="intro" initial={{ opacity: 0, filter: 'blur(8px)' }} animate={{ opacity: introVisible ? 1 : 0, filter: introVisible ? 'blur(0px)' : 'blur(8px)' }} transition={{ duration: 3, ease: 'easeInOut' }} className="text-zinc-400 text-sm md:text-base tracking-[0.2em] font-light leading-relaxed text-center">
              {lang.RESTING.intro}
            </motion.p>
          ) : (
            <motion.p key="ambient" initial={{ opacity: 0, filter: 'blur(8px)' }} animate={{ opacity: isAmbientVisible && ambientText ? 1 : 0, filter: isAmbientVisible && ambientText ? 'blur(0px)' : 'blur(8px)' }} transition={{ duration: 3, ease: 'easeInOut' }} className="text-zinc-500 text-sm md:text-base tracking-[0.2em] font-light leading-relaxed text-center">
              {ambientText.startsWith('...') ? ambientText : `[ ${ambientText} ]`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-32 flex flex-col items-center justify-center h-16 gap-6 z-10">
        <AnimatePresence>
          {showMint && (
            <motion.button key="mint-candy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 3 }} onClick={() => handleConsume('mint')} className="text-zinc-500 opacity-40 hover:opacity-100 hover:text-cyan-200 text-xs md:text-sm tracking-[0.2em] font-light transition-all duration-1000 outline-none cursor-pointer">
              [ {lang.RESTING.mint} ]
            </motion.button>
          )}
          {showOrange && (
            <motion.button key="half-orange" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 3 }} onClick={() => handleConsume('orange')} className="text-zinc-500 opacity-40 hover:opacity-100 hover:text-orange-200 text-xs md:text-sm tracking-[0.2em] font-light transition-all duration-1000 outline-none cursor-pointer">
              [ {lang.RESTING.orange} ]
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}