'use client'
import { useEffect } from 'react'
import { useShelterStore } from '../store/useShelterStore'

export default function DataMigrator() {
  useEffect(() => {
    // 防御机制：只执行一次
    const hasMigrated = localStorage.getItem('eh_v1_migrated')
    if (hasMigrated) return

    try {
      // 精准狙击旧版 localStorage Key
      const oldDataRaw = localStorage.getItem('entries')
      
      if (oldDataRaw && oldDataRaw.length > 5) {
        const oldData = JSON.parse(oldDataRaw)
        
        if (Array.isArray(oldData)) {
          // 挂载新的 Store
          const store = useShelterStore.getState()
          const { entries, addEntry } = store
          
          let recoverCount = 0
          
          // 倒序/顺序遍历旧数据，重新注入 Zustand
          oldData.forEach((oldEntry: any) => {
             // 严格去重：防止重复导入
             if (!entries.some(e => e.id === oldEntry.id)) {
                addEntry(oldEntry)
                recoverCount++
             }
          })
          
          console.log(`[CTO] 抢救成功：从 entries 定向引渡了 ${recoverCount} 条历史小票。`)
        }
      }

      // 打上引渡成功的钢印，这辈子不再执行第二次
      localStorage.setItem('eh_v1_migrated', 'true')
      
    } catch (e) {
      console.error('[CTO] 数据引渡失败:', e)
    }
  }, [])

  return null // 这是一个幽灵组件，不渲染任何 UI
}