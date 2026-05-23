'use client';

import { useEffect, useState } from 'react';

// 🏪 破店专属：物理空间底噪库
const SPATIAL_NOISES = [
  "吧台的顶灯忽明忽暗地闪烁着...",
  "Rin 正拿着扫把在慢吞吞地扫地...",
  "角落里，那个 8 岁的小孩正盯着旧电视...",
  "Ash 好像又在后厨摔杯子了...",
  "门外的晚风把卷帘门吹得有些松动...",
  "远处隐约传来高架桥上沉闷的车流声...",
  "吧台角落的那盏台灯今天彻底罢工了...",
  "碎纸机嘎吱嘎吱地响，好像卡住了半张票据...",
  "不知道谁在吧台留了半杯冷掉的黑咖啡...",
  "老头又在翻那本掉了页的破书，半天没翻过去一页..."
];

export default function Loading() {
  const [noise, setNoise] = useState('');

  useEffect(() => {
    // 门外拉闸瞬间，随机飘过去一句空间噪音
    const randomNoise = SPATIAL_NOISES[Math.floor(Math.random() * SPATIAL_NOISES.length)];
    setNoise(randomNoise);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#12100e', // 保持和你首页完全一致的深夜暗金色调底色
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden'
    }}>
      
      {/* 1. 正中央极致留白：只有一个微弱、缓慢呼吸的暗金光点，代表屋里亮着一盏微弱的灯 */}
      <div style={{
        width: '3px',
        height: '3px',
        borderRadius: '50%',
        background: 'rgba(245,200,66,0.3)',
        boxShadow: '0 0 10px rgba(245,200,66,0.15)',
        animation: 'pulse 2.5s infinite ease-in-out'
      }} />

      {/* 2. 右下角的微弱空间底噪：不显眼，不打扰 */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        fontSize: '11px',
        color: '#8f857a',
        opacity: 0.35, // 极低的透明度，像水印一样边缘化
        letterSpacing: '0.05em',
        pointerEvents: 'none',
        maxWidth: '80%',
        textAlign: 'right',
        lineHeight: '1.6',
        fontWeight: '300'
      }}>
        {noise}
      </div>

      {/* 注入纯 CSS 呼吸动画 */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 0.7; transform: scale(1.1); }
          100% { opacity: 0.2; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}