// hooks/useTraces.ts
import useSWR from 'swr'
import { useCallback } from 'react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

// CDO 规范定义的痕迹文本配置类型
type TraceConfig = {
  hot: string;  // < 10分钟
  warm: string; // 10 - 60分钟
  cold: string; // > 60分钟 (默认冷清)
}

export function useTraces() {
  // 严格遵守 300,000ms 轮询，关闭焦点重新请求防止频繁打后端
  const { data } = useSWR('/api/traces', fetcher, {
    refreshInterval: 300000, 
    revalidateOnFocus: false,
    revalidateIfStale: false
  })

  const traces = data?.traces || []

  // 核心逻辑：时间错位运算
  const getTraceStatus = useCallback((itemId: string, config: TraceConfig) => {
    const trace = traces.find((t: any) => t.item_id === itemId)
    if (!trace) return config.cold

    const lastActiveMs = new Date(trace.last_active_at).getTime()
    const minutesAgo = (Date.now() - lastActiveMs) / (1000 * 60)

    if (minutesAgo < 10) return config.hot
    if (minutesAgo >= 10 && minutesAgo < 60) return config.warm
    return config.cold
  }, [traces])

  // 静默上报机制 (不阻塞UI，不等待响应)
  const leaveTrace = useCallback((itemId: string) => {
    fetch('/api/traces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
      keepalive: true // 极其关键：允许在关闭网页/路由切换的瞬间完成请求发送
    }).catch(() => { /* 失败了也无所谓，符合避难所随缘的基调 */ })
  }, [])

  return { getTraceStatus, leaveTrace }
}