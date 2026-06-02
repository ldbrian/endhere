// store/useEntityStore.ts
import { create } from 'zustand'

// ================= V1.5 静态物品字典 =================
export const ENTITY_DICT = {
  stool: { 
    id: 'stool', 
    type: 'surface', 
    movable: true, 
    allowed_on_top: ['human', 'cat'] 
  }
}
// =====================================================

export interface EntityState {
  stoolLocation: 'corner' | 'bar'
  onTop: null | 'human'
  
  // 【V2 架构补齐】：适配 settlement 引擎的实体感知与 TS 类型检查
  entities: any[]
  bar_counter: any | null
  
  moveStool: (location: 'corner' | 'bar') => void
  toggleSit: () => void
}

export const useEntityStore = create<EntityState>((set, get) => ({
  stoolLocation: 'corner', // 默认在角落
  onTop: null,             // 默认上面没人
  
  // 【V2 架构补齐】：初始化世界实体与吧台状态
  entities: [],
  bar_counter: null,

  // 动作：移动凳子
  moveStool: (loc) => {
    const state = get()
    // 【核心互斥拦截】：如果凳子上有人，绝对不允许移动！
    if (state.onTop !== null) {
      console.warn('物理限制：凳子上有人，无法移动。')
      return 
    }
    set({ stoolLocation: loc })
  },

  // 动作：坐下/站起
  toggleSit: () => {
    set((state) => ({ 
      onTop: state.onTop === null ? 'human' : null 
    }))
  }
}))