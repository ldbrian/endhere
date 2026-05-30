// store/useEntityStore.ts
import { create } from 'zustand'

interface EntityState {
  stoolLocation: 'corner' | 'bar'
  stoolStatus: 'idle' | 'occupied'
  moveStool: (location: 'corner' | 'bar') => void
  setStoolStatus: (status: 'idle' | 'occupied') => void
}

export const useEntityStore = create<EntityState>((set) => ({
  stoolLocation: 'corner', // 默认在角落
  stoolStatus: 'idle',     // 默认空闲
  moveStool: (loc) => set({ stoolLocation: loc }),
  setStoolStatus: (status) => set({ stoolStatus: status }),
}))