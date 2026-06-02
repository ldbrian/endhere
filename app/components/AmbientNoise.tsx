'use client'
import { useState, useEffect } from 'react';
import { useWorldState } from '../store/useWorldState';
import { AMBIENT_WHISPERS } from '../lib/ambientWhispers';

export function AmbientNoise() {
  // 从全局状态机订阅当前时间切片
  const timeSlice = useWorldState(state => state.timeSlice);
  
  const [noise, setNoise] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const whispers = AMBIENT_WHISPERS[timeSlice] || AMBIENT_WHISPERS['DAYTIME'];
    
    const triggerNoise = () => {
      if (Math.random() > 0.3) {
        const randomWhisper = whispers[Math.floor(Math.random() * whispers.length)];
        
        // 1. 挂载文本
        setNoise(randomWhisper);
        // 2. 触发 3s 极慢显影
        setIsVisible(true);
        
        // 3. 停留 4s 后触发 3s 极慢消散
        setTimeout(() => setIsVisible(false), 4000); 
      }
    };

    // 每 15 秒判定一次是否有底噪降临
    const soundInterval = setInterval(triggerNoise, 15000);
    return () => clearInterval(soundInterval);
  }, [timeSlice]);

  return (
    /* 
      物理防抖：min-h-[1.5rem] 确保空间始终被撑开
      视觉约束：pointer-events-none 彻底阻断误触
    */
    <div className="w-full flex justify-center items-center min-h-[1.5rem] py-2 pointer-events-none">
      <div 
        className={`
          text-[9px] text-[#554f47] italic tracking-[0.1em] text-center font-mono
          transition-opacity duration-[3000ms] ease-in-out
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
      >
        {noise ? `[ ${noise} ]` : ''}
      </div>
    </div>
  );
}