// lib/telemetry.ts

export const trackSpaceEvent = (eventName: string, payload: any = {}) => {
  try {
    // 异步静默发送，绝不 await，绝不阻塞主线程
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventName, ...payload }),
      keepalive: true, // 核心机制：确保即使用户点完立刻跳走，请求也能送达
    }).catch(() => {}) // 吞掉一切网络错误，静默失败
  } catch (e) {
    // 保持绝对静默
  }
}

// 专门为页面卸载/关闭时准备的灯塔发送器
export const sendBeaconEvent = (eventName: string, payload: any = {}) => {
  try {
    const blob = new Blob([JSON.stringify({ event: eventName, ...payload })], {
      type: 'application/json'
    })
    navigator.sendBeacon('/api/telemetry', blob)
  } catch (e) {
    // 保持绝对静默
  }
}