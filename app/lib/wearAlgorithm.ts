// lib/wearAlgorithm.ts
export const getPhysicalWearStyles = (timestamp: number) => {
  const now = Date.now();
  // 计算天数差，防止未来时间导致的负数
  const daysOld = Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
  const MAX_DECAY_DAYS = 30; 
  const decayRatio = Math.min(daysOld / MAX_DECAY_DAYS, 1);

  // 透明度衰减算法：从 0.9 线性降至 0.3
  const opacity = 0.9 - (0.6 * decayRatio);
  
  // 物理字重剥落映射
  let fontWeightClass = 'font-normal';
  if (decayRatio > 0.7) {
    fontWeightClass = 'font-thin';
  } else if (decayRatio > 0.4) {
    fontWeightClass = 'font-light';
  }

  return {
    opacity: Number(opacity.toFixed(2)),
    className: fontWeightClass
  };
};