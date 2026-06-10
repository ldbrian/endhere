import { supabase } from './supabase';

export const track = async (eventName: string, properties: Record<string, any> = {}) => {
  if (typeof window === 'undefined') return;

  try {
    // 🟢 1. 匿名设备指纹：哪怕不登录，也能精准统计真实物理设备数 (UV)
    let deviceId = localStorage.getItem('eh_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('eh_device_id', deviceId);
    }

    // 🟢 2. 会话与访问次数防抖：解决你之前的新老用户误判问题
    let visitCount = parseInt(localStorage.getItem('eh_total_visits') || '0', 10);
    const hasCountedThisSession = sessionStorage.getItem('eh_session_counted');

    if (!hasCountedThisSession) {
      visitCount += 1;
      localStorage.setItem('eh_total_visits', visitCount.toString());
      sessionStorage.setItem('eh_session_counted', 'true');
    }

    // 访问次数 > 1 即为回头客
    const isReturningUser = visitCount > 1;

    // 🟢 3. 组装强化的 Payload
    const enrichedPayload = {
      ...properties,
      url: window.location.pathname,
      screen_width: window.innerWidth, // 顺手带上设备屏幕宽度，方便以后做移动端适配分析
    };

    // 开发环境：在控制台静默打印，方便 debug
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Supabase Tracker] ${eventName}`, { deviceId, visitCount, isReturningUser, ...enrichedPayload });
    }

    // 🟢 4. 异步落库（不阻塞主线程）
    await supabase.from('visit_logs').insert([{
      device_id: deviceId,
      event_name: eventName,
      is_returning: isReturningUser,
      visit_count: visitCount,
      payload: enrichedPayload,
      // created_at 会由数据库默认生成
    }]);

  } catch (e) {
    console.warn('[Telemetry Warning] Failed to log event:', e);
  }
};