import { create } from 'zustand';
import { calculateTimeSlice, TimeSlice } from '../lib/time';
import { settleTimeLapse } from '../lib/settlement';

interface WorldState {
  timeSlice: TimeSlice;
  weather: 'clear' | 'rain' | 'fog';
  lastUpdated: number;
  // 核心：同步时间状态
  syncTime: () => void;
}

export const useWorldState = create<WorldState>((set) => ({
  timeSlice: calculateTimeSlice(new Date()),
  weather: 'clear',
  lastUpdated: Date.now(),

  // 在 useWorldState.ts 中更新 syncTime
syncTime: () => {
  const now = new Date();
  const last = useWorldState.getState().lastUpdated;
  const elapsedHours = (now.getTime() - last) / (1000 * 60 * 60);

  // 执行结算引擎
  if (elapsedHours >= 1) { // 超过 1 小时才触发结算，减少开销
    settleTimeLapse(elapsedHours, calculateTimeSlice(now));
  }

  set({
    timeSlice: calculateTimeSlice(now),
    lastUpdated: now.getTime()
  });
}
}));