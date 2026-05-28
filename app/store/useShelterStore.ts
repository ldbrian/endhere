// store/useShelterStore.ts (补充更新)
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface ShelterState {
  lastClaimedDate: string | null
  markClaimed: () => void
  canClaimToday: () => boolean

  entries: any[]
  setEntries: (entries: any[]) => void
  addEntry: (entry: any) => void
  updateEntry: (id: string | number, updatedData: any) => void
  deleteEntry: (id: string | number) => void

  // --- [CTO 新增] 世界事件引擎 ---
  weather: 'clear' | 'rain'
  isWeatherInitialized: boolean
  initWeather: () => void
}

const getTodayStr = () => {
  return new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

export const useShelterStore = create<ShelterState>()(
  persist(
    (set, get) => ({
      lastClaimedDate: null,
      markClaimed: () => set({ lastClaimedDate: getTodayStr() }),
      canClaimToday: () => get().lastClaimedDate !== getTodayStr(),

      entries: [],
      setEntries: (entries) => set({ entries }),
      addEntry: (entry) => set((state) => ({ entries: [entry, ...state.entries] })),
      updateEntry: (id, updatedData) => set((state) => ({
        entries: state.entries.map((e) => (e.id === id ? { ...e, ...updatedData } : e))
      })),
      deleteEntry: (id) => set((state) => ({
        entries: state.entries.filter((e) => e.id !== id)
      })),

      // --- [CTO 新增] 世界事件逻辑 ---
      weather: 'clear',
      isWeatherInitialized: false,
      initWeather: () => {
        if (!get().isWeatherInitialized) {
          // 20% 的概率下雨
          const isRaining = Math.random() < 0.20
          set({ 
            weather: isRaining ? 'rain' : 'clear',
            isWeatherInitialized: true 
          })
        }
      }
    }),
    {
      name: 'endhere-shelter-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)