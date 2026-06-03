import { useState, useEffect, useRef } from 'react';
import { TimeSlice } from '../lib/time';

// 环境白描词条库 (可按需扩充)
const AMBIENT_TEXTS: Record<TimeSlice, string[]> = {
  DEEP_NIGHT: ['吧台深处传来木头轻微爆裂的脆响。', '暗光中，灰尘的轨迹变得清晰。'],
  DAWN: ['清晨的湿气正沿着门缝渗入。'],
  DAYTIME: ['远处传来隐约的车流声。'],
  DUSK_TO_MIDNIGHT: ['余晖褪去，角落的阴影被无限拉长。']
};

export function useAmbientIdle(currentSlice: TimeSlice) {
  const [isDimmed, setIsDimmed] = useState(false);
  const [ambientText, setAmbientText] = useState<string | null>(null);
  
  const timeout15Ref = useRef<NodeJS.Timeout | null>(null);
  const timeout30Ref = useRef<NodeJS.Timeout | null>(null);

  const resetIdleState = () => {
    // 瞬间打断：恢复亮度，驱散文本
    setIsDimmed(false);
    setAmbientText(null);

    if (timeout15Ref.current) clearTimeout(timeout15Ref.current);
    if (timeout30Ref.current) clearTimeout(timeout30Ref.current);

    // 重新开启 15秒 视觉下沉计时
    timeout15Ref.current = setTimeout(() => {
      setIsDimmed(true);
    }, 15000);

    // 重新开启 30秒 环境文本计时
    timeout30Ref.current = setTimeout(() => {
      const texts = AMBIENT_TEXTS[currentSlice] || AMBIENT_TEXTS['DAYTIME'];
      const randomText = texts[Math.floor(Math.random() * texts.length)];
      setAmbientText(randomText);
    }, 30000);
  };

  useEffect(() => {
    const activeEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    
    // 使用 requestAnimationFrame 节流，避免高频触发导致性能灾难
    let ticking = false;
    const handleActivity = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          resetIdleState();
          ticking = false;
        });
        ticking = true;
      }
    };

    activeEvents.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    
    // 初始化挂载时立刻启动计时
    resetIdleState();

    return () => {
      activeEvents.forEach(evt => window.removeEventListener(evt, handleActivity));
      if (timeout15Ref.current) clearTimeout(timeout15Ref.current);
      if (timeout30Ref.current) clearTimeout(timeout30Ref.current);
    };
  }, [currentSlice]); // 切片变更时重新绑定，确保拉取正确的词条

  return { isDimmed, ambientText };
}