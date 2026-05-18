export async function track(event_name: string, properties?: Record<string, any>) {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name, properties }),
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