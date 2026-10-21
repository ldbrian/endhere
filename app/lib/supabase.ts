import { createClient } from '@supabase/supabase-js';

// 强校验：拦截环境变量缺失
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('CTO 警告: 缺失 Supabase 环境变量 (NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY)。请在 .env.local 中配置。');
}

const DEVICE_ID_KEY = 'eh_device_id';
const OWNER_STORAGE_KEY = 'endhere_v2_storage';

// 浏览器端每次请求动态带设备 id，供 RLS 校验 owner_id/device_id。
// EH 本地书的 ownerId（local_*）与访问设备 id 不同，另带 x-owner-id 供 fragments 策略校验。
const fetchWithDeviceId: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (typeof window !== 'undefined') {
    try {
      const deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
      if (deviceId) headers.set('x-device-id', deviceId);

      const raw = window.localStorage.getItem(OWNER_STORAGE_KEY);
      const ownerId = raw ? JSON.parse(raw)?.state?.ownerId : null;
      if (typeof ownerId === 'string' && ownerId) headers.set('x-owner-id', ownerId);
    } catch {
      // 隐私模式/存储损坏：不带头，由 RLS 拒绝写操作。
    }
  }
  return fetch(input, { ...init, headers });
};

// 导出唯一的 Supabase 客户端单例
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithDeviceId },
});