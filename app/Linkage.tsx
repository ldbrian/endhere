'use client';

import { useEffect } from 'react';

// BeginHere ↔ EndHere 跨产品身份打通：
// 对方带 ?eh_device_id=xxx 跳转过来时，若本域尚无 eh_device_id 则写入（已有则保留自己的）。
// 两端共用同一 localStorage key 与 UUID 格式，落地后即定位到同一用户。
const DEVICE_ID_KEY = 'eh_device_id';

export default function Linkage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(DEVICE_ID_KEY)) return;
      const fromUrl = new URL(window.location.href).searchParams.get('eh_device_id');
      if (fromUrl && /^[0-9a-f-]{20,}$/i.test(fromUrl)) {
        localStorage.setItem(DEVICE_ID_KEY, fromUrl);
      }
    } catch {
      // 隐私模式等异常不影响页面
    }
  }, []);
  return null;
}