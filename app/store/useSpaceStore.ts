import { create } from 'zustand';

// 🟢 扩充 Scene，增加 incinerator
export type Scene = 'entrance' | 'speaking' | 'trashing' | 'resting' | 'nostalgia' | 'roaming' | 'incinerator' | 'mirror' | 'shopkeeper';

export interface RuminationContext {
  entryId: number | string;  // 被反刍的小票 id
  receiptId: string;
  originalContent: string;   // 原始用户文字
  originalTimestamp: number;
  mind_track?: string;       // 历史 AI 摘要（可能为空）
  persona: string;           // 继续用同一个 persona
}

interface SpaceState {
  currentScene: Scene;
  setScene: (scene: Scene) => void;
  
  // 焚烧区的数据传送带
  incineratorTarget: any | null; 
  setIncineratorTarget: (target: any | null) => void;

  // 反刍对话传送带：从怀念区携带历史上下文进入倾诉场景
  ruminationContext: RuminationContext | null;
  setRuminationContext: (ctx: RuminationContext | null) => void;
}

export const useSpaceStore = create<SpaceState>((set) => ({
  currentScene: 'entrance',
  setScene: (scene) => set({ currentScene: scene }),
  
  // 🟢 初始状态为空
  incineratorTarget: null,
  setIncineratorTarget: (target) => set({ incineratorTarget: target }),

  ruminationContext: null,
  setRuminationContext: (ctx) => set({ ruminationContext: ctx }),
}));