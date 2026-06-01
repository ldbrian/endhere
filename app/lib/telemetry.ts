// lib/telemetry.ts

export const trackSpaceEvent = async (eventName: string, payload: any = {}) => {
  // 如果 payload 为空对象，给它一个默认的时间戳或标记，防止数据库存入 NULL
  const dataToSave = payload && Object.keys(payload).length > 0 ? payload : { timestamp: Date.now() };
  
  await fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      payload: dataToSave // 确保这里永远不是 undefined 或 null
    })
  });
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