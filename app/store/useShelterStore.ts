import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 🟢 将日期计算器提取到外部，避免破坏状态机结构
const getHangzhouDate = () => {
  const d = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
};

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
  type?: 'receipt' | 'virtual_item' | 'life_fragment';
  mind_track?: string; 
  patches?: Array<{
    timestamp: string;   
    mind_track: string;  
    content: string;     
    ai_reply: string;    
  }>;
}

interface ShelterState {
  entries: ShelterEntry[]
  addEntry: (entry: ShelterEntry) => void
  updateEntry: (id: number | string, updates: Partial<ShelterEntry>) => void
  deleteEntry: (id: number | string) => void
  removeEntry: (id: number | string) => void 
  addPatch: (entryId: number | string, patch: NonNullable<ShelterEntry['patches']>[number]) => void
  
  // 🟢 反刍上下文
  ruminationContext: {
    entryId: number | string;
    originalContent: string;
    originalTimestamp: number;
    mind_track?: string;
  } | null;
  setRuminationContext: (ctx: ShelterState['ruminationContext']) => void;

  // 🟢 铁筐防通胀锁
  basketPutDate: string | null;
  basketTakeDate: string | null;
  canInteractBasketToday: (type: 'put' | 'take') => boolean;
  markBasketInteraction: (type: 'put' | 'take') => void;
  
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
        return new Date(last).toLocaleDateString() !== new Date().toLocaleDateString()
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
      setRuminationContext: (ctx) => set({ ruminationContext: ctx }),

      deleteEntry: (id) => set((state) => ({
        entries: state.entries.map((e) => e.id === id ? { ...e, status: '已销毁' } : e)
      })),

      removeEntry: (id) => set((state) => ({
        entries: state.entries.filter((e) => e.id !== id)
      })),

      addPatch: (entryId, patch) => set((state) => ({
        entries: state.entries.map((e) =>
          e.id === entryId ? { ...e, patches: [...(e.patches || []), patch] } : e
        )
      })),

      // 🟢 铁筐时间锁实现
      basketPutDate: null,
      basketTakeDate: null,
      canInteractBasketToday: (type) => {
        const today = getHangzhouDate();
        const lastDate = type === 'put' ? get().basketPutDate : get().basketTakeDate;
        return lastDate !== today;
      },
      markBasketInteraction: (type) => {
        const today = getHangzhouDate();
        if (type === 'put') set({ basketPutDate: today });
        if (type === 'take') set({ basketTakeDate: today });
      }
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