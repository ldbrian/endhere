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
  // 👇 补充缺失的 AI 解析与交互字段
  analysis?: string
  punchline?: string
  sessions?: any[] // 用于 ruminate 回味页面的追加数据
  // 👆 ----------------------------
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
}

export const useShelterStore = create<ShelterState>()(
  persist(
    (set) => ({
      entries: [],
      
      // 数据层下沉：写入动作内部自带 Schema 防御，拒绝 UI 层传错参数污染持久层
      addEntry: (entry) => set((state) => {
        if (!entry || typeof entry.id !== 'number') return state // 阻断无效结构
        
        const safeEntry = {
          ...entry,
          // 防御性补齐：即使 UI 层漏传，也强制生成符合规范的 fallback
          receiptId: entry.receiptId || `EH-OLD-${entry.id.toString().slice(-4)}`
        }
        
        return { entries: [safeEntry, ...state.entries] }
      }),

      updateEntry: (id, updates) => set((state) => ({
        entries: state.entries.map((e) => {
          if (e.id === id) {
            const merged = { ...e, ...updates }
            // 核心锁：严禁在更新过程中抹除已固化的 receiptId
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
      name: 'endhere-shelter-storage', // 持久化缓存键名
      version: 2, // 锁死 Version 2 迁移机制
      
      // 必须严格执行的硬编码迁移逻辑
      migrate: (persistedState: any, version: number) => {
        // 捕获 version 1 或无版本号的远古数据
        if (version === 1 || version === 0 || !version) {
          const state = persistedState as ShelterState;
          state.entries = (state.entries || []).map((entry: any) => ({
            ...entry,
            // 核心防御线：老数据若无 receiptId，在内存中强行补齐旧版字符串契约
            receiptId: entry.receiptId || `EH-OLD-${entry.id.toString().slice(-4)}`
          }));
          return state;
        }
        return persistedState;
      }
    }
  )
)