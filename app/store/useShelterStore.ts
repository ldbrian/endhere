import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ShelterEntry {
  id: number | string 
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
  receiptId: string 
  manager_message?: string
  manager_reply?: string
  isSealed?: boolean
  sealedUntil?: number
  destinedItem?: any
  // 🟢 扩充类型：增加 life_fragment
  type?: 'receipt' | 'virtual_item' | 'life_fragment';
  // 反刍补丁日志
  mind_track?: string; // 本条记录提炼出的核心情绪摘要（由 AI 生成）
  patches?: Array<{
    timestamp: string;   // ISO，北京时间
    mind_track: string;  // 本次反刍的 AI 摘要
    content: string;     // 用户本次说的话
    ai_reply: string;    // AI 本次回复
  }>;
}

interface ShelterState {
  entries: ShelterEntry[]
  addEntry: (entry: ShelterEntry) => void
  updateEntry: (id: number | string, updates: Partial<ShelterEntry>) => void
  deleteEntry: (id: number | string) => void
  removeEntry: (id: number | string) => void 
  addPatch: (entryId: number | string, patch: NonNullable<ShelterEntry['patches']>[number]) => void
  ruminationContext: {
  entryId: number | string;
  originalContent: string;
  originalTimestamp: number;
  mind_track?: string;
} | null;

setRuminationContext: (
  ctx: {
    entryId: number | string;
    originalContent: string;
    originalTimestamp: number;
    mind_track?: string;
  } | null
) => void;
  
  lastClaimedAt: number | null
  canClaimToday: () => boolean
  markClaimed: () => void
  
  hasMint: boolean
  consumeMint: () => void
}

export const useShelterStore = create<ShelterState>()(
  persist(
    (set, get) => ({
      entries: [],
      
      lastClaimedAt: null,
      
      canClaimToday: () => {
        const last = get().lastClaimedAt
        if (!last) return true
        
        const lastDate = new Date(last).toLocaleDateString()
        const today = new Date().toLocaleDateString()
        return lastDate !== today
      },
      
      markClaimed: () => set({ lastClaimedAt: Date.now() }),

      hasMint: true,
      consumeMint: () => set({ hasMint: false }),

      addEntry: (entry) => set((state) => {
        if (!entry || !entry.id) return state 
        
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

      ruminationContext: null,

      setRuminationContext: (ctx) =>
        set({
          ruminationContext: ctx
        }),

      deleteEntry: (id) => set((state) => ({
        entries: state.entries.map((e) => 
          e.id === id ? { ...e, status: '已销毁' } : e
        )
      })),

      removeEntry: (id) => set((state) => ({
        entries: state.entries.filter((e) => e.id !== id)
      })),

      addPatch: (entryId, patch) => set((state) => ({
        entries: state.entries.map((e) =>
          e.id === entryId
            ? { ...e, patches: [...(e.patches || []), patch] }
            : e
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