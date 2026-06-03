import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ShelterEntry {
  id: number
  timestamp: number
  createdAt?: string
  emotionStart?: number
  emotionEnd?: number
  emotion?: string
  status: string
  persona?: string
  content: string
  rawResponse?: string
  analysis?: string
  punchline?: string
  sessions?: any[]
  released?: boolean
  receiptId: string // V2 核心契约：必须存在的唯一真源 ID
  manager_message?: string
  manager_reply?: string
  isSealed?: boolean
  sealedUntil?: number
  destinedItem?: any
}

interface ShelterState {
  entries: ShelterEntry[]
  addEntry: (entry: ShelterEntry) => void
  updateEntry: (id: number, updates: Partial<ShelterEntry>) => void
  deleteEntry: (id: number) => void
  
  // 👇 补充缺失的“铁筐领取记录”契约
  lastClaimedAt: number | null
  canClaimToday: () => boolean
  markClaimed: () => void
}

export const useShelterStore = create<ShelterState>()(
  persist(
    (set, get) => ({
      entries: [],
      
      // ==========================================
      // 铁筐领取冷却引擎
      // ==========================================
      lastClaimedAt: null,
      
      canClaimToday: () => {
        const last = get().lastClaimedAt
        if (!last) return true
        
        // 物理防御：按自然日计算冷却时间
        const lastDate = new Date(last).toLocaleDateString()
        const today = new Date().toLocaleDateString()
        return lastDate !== today
      },
      
      markClaimed: () => set({ lastClaimedAt: Date.now() }),

      // ==========================================
      // 小票数据流转引擎
      // ==========================================
      addEntry: (entry) => set((state) => {
        if (!entry || typeof entry.id !== 'number') return state 
        
        const safeEntry = {
          ...entry,
          receiptId: entry.receiptId || `EH-OLD-${entry.id.toString().slice(-4)}`
        }
        
        return { entries: [safeEntry, ...state.entries] }
      }),

      updateEntry: (id, updates) => set((state) => ({
        entries: state.entries.map((e) => {
          if (e.id === id) {
            const merged = { ...e, ...updates }
            if (!merged.receiptId) merged.receiptId = e.receiptId
            return merged
          }
          return e
        })
      })),

      deleteEntry: (id) => set((state) => ({
        entries: state.entries.map((e) => 
          e.id === id ? { ...e, status: '已销毁' } : e
        )
      }))
    }),
    {
      name: 'endhere-shelter-storage', 
      version: 2, 
      
      migrate: (persistedState: any, version: number) => {
        if (version === 1 || version === 0 || !version) {
          const state = persistedState as ShelterState;
          state.entries = (state.entries || []).map((entry: any) => ({
            ...entry,
            receiptId: entry.receiptId || `EH-OLD-${entry.id.toString().slice(-4)}`
          }));
          return state;
        }
        return persistedState;
      }
    }
  )
)