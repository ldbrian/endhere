export async function track(event_name: string, properties: Record<string, any> = {}) {
  try {
    // 1. 在前端静默抓取用户的本地访问次数 (加个 window 判断防 SSR 报错)
    let visitCount = 1;
    if (typeof window !== 'undefined') {
      visitCount = parseInt(localStorage.getItem('endhere_visit_count') || '1', 10);
    }

    // 2. 把 visitCount 缝合进埋点属性里
    const enrichedProperties = {
      ...properties,
      visitCount,
    };

    // 3. 发送给后端
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name, properties: enrichedProperties }),
      // CTO 核心补丁：确保组件卸载、页面关闭时，fetch 请求不会被浏览器强行终止
      keepalive: true, 
    })
  } catch {
    // 埋点失败不影响主流程
  }
}

export async function checkLimit(): Promise<{ allowed: boolean; count?: number; limit?: number }> {
  try {
    const res = await fetch('/api/check-limit', { method: 'POST' })
    return await res.json()
  } catch {
    return { allowed: true }
  }
}