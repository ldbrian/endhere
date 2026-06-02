// app/store/useWorldEngine.ts
import { create } from 'zustand'
import { trackSpaceEvent } from '../lib/telemetry'
import { useEntityStore } from './useEntityStore'

interface WorldState {
  pendingMutations: Record<string, any>;
  // 【重构签名】：兼容旧有的纯字符串入参，且完美支持 V2 架构的对象配置 Payload 入参
  mutateWorld: (params: string | { action: string; payload?: any }) => void;
  flushToWorld: () => Promise<void>;
}

export const useWorldEngine = create<WorldState>((set, get) => ({
  pendingMutations: {},

  mutateWorld: (params) => {
    let action: string;
    let payload: any = null;

    // 参数类型归一化处理
    if (typeof params === 'string') {
      action = params;
    } else {
      action = params.action;
      payload = params.payload;
    }

    // 1. 累加并存入延迟刷新的快照队列中
    set((state) => {
      const currentVal = state.pendingMutations[action] || 0;
      return {
        pendingMutations: {
          ...state.pendingMutations,
          [action]: typeof currentVal === 'number' ? currentVal + 1 : 1
        }
      };
    });

    // 2. 派发全域遥测空间事件
    trackSpaceEvent(`WORLD_INTERACT_${action.toUpperCase()}`, payload);

    // 3. 【核心物理桥接】：将引擎产生的世界副作用实时向下同步至实体状态树 (useEntityStore)
    if (action === 'inject_item' && payload?.target === 'bar_counter') {
      useEntityStore.setState({ 
        bar_counter: { item_id: payload.item_id, metadata: payload.metadata } 
      });
    }
    
    if (action === 'remove_item' && payload?.target === 'bar_counter') {
      useEntityStore.setState({ 
        bar_counter: null 
      });
    }
  },

  flushToWorld: async () => {
    const mutations = get().pendingMutations
    if (Object.keys(mutations).length === 0) return

    try {
      const blob = new Blob([JSON.stringify(mutations)], { type: 'application/json' })
      navigator.sendBeacon('/api/world/snapshot', blob)
      set({ pendingMutations: {} })
    } catch (e) {
      console.warn('[World Engine] 快照同步受阻。')
    }
  }
}))