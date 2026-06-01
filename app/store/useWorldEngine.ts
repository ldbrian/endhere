// app/store/useWorldEngine.ts
import { create } from 'zustand'
import { trackSpaceEvent } from '../lib/telemetry'

interface WorldState {
  pendingMutations: {
    water_plant?: number;
    radio_tuning?: number;
  };
  mutateWorld: (action: 'water_plant' | 'radio_tuning') => void;
  flushToWorld: () => Promise<void>;
}

export const useWorldEngine = create<WorldState>((set, get) => ({
  pendingMutations: {},

  mutateWorld: (action) => {
    set((state) => {
      const currentVal = state.pendingMutations[action] || 0
      return {
        pendingMutations: {
          ...state.pendingMutations,
          [action]: currentVal + 1
        }
      }
    })
    trackSpaceEvent(`WORLD_INTERACT_${action.toUpperCase()}`)
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