import { create } from 'zustand';
import { calculateTimeSlice, TimeSlice } from '../lib/time';
// 1. 修正导入：引入全新的惰性结算引擎
import { settleWorldState } from '../lib/settlement';

interface WorldState {
  timeSlice: TimeSlice;
  weather: 'clear' | 'rain' | 'fog';
  lastUpdated: number;
  syncTime: () => void;
}

export const useWorldState = create<WorldState>((set) => ({
  timeSlice: calculateTimeSlice(new Date()),
  weather: 'clear',
  lastUpdated: Date.now(),

  syncTime: () => {
    const now = new Date();
    const last = useWorldState.getState().lastUpdated;

    // 2. 核心修正：调用全新的惰性结算引擎，直接传入上一次的时间戳
    // 内部的防抖和切片跨越逻辑交由引擎自己判断，这里只管触发
    settleWorldState(last);

    // 3. 更新当前系统时间与切片快照
    set({
      timeSlice: calculateTimeSlice(now),
      lastUpdated: now.getTime()
    });
  }
}));