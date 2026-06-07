import { create } from 'zustand';

// 🟢 扩充 Scene，增加 incinerator
export type Scene = 'entrance' | 'speaking' | 'trashing' | 'resting' | 'nostalgia' | 'roaming' | 'incinerator';

interface SpaceState {
  currentScene: Scene;
  setScene: (scene: Scene) => void;
  
  // 🟢 焚烧区的数据传送带
  incineratorTarget: any | null; 
  setIncineratorTarget: (target: any | null) => void;
}

export const useSpaceStore = create<SpaceState>((set) => ({
  currentScene: 'entrance',
  setScene: (scene) => set({ currentScene: scene }),
  
  // 🟢 初始状态为空
  incineratorTarget: null,
  setIncineratorTarget: (target) => set({ incineratorTarget: target }),
}));