'use client';

import { supabase } from '../../lib/supabase';

const DEVICE_ID_KEY = 'eh_device_id';
const TOTAL_VISITS_KEY = 'eh_total_visits';
const SESSION_COUNTED_KEY = 'eh_session_counted';
const SESSION_ID_KEY = 'eh_session_id';

function getSessionId() {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

export async function track(eventName: string, properties: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    let visitCount = parseInt(localStorage.getItem(TOTAL_VISITS_KEY) || '0', 10);
    const hasCountedThisSession = sessionStorage.getItem(SESSION_COUNTED_KEY);

    if (!hasCountedThisSession) {
      visitCount += 1;
      localStorage.setItem(TOTAL_VISITS_KEY, visitCount.toString());
      sessionStorage.setItem(SESSION_COUNTED_KEY, 'true');
    }

    const referrer = document.referrer || '';
    const referrerPath = referrer
      ? (() => {
          try {
            const parsed = new URL(referrer);
            return `${parsed.pathname}${parsed.search}`;
          } catch {
            return referrer;
          }
        })()
      : '';

    const payload = {
      ...properties,
      path: window.location.pathname,
      search: window.location.search,
      url: `${window.location.pathname}${window.location.search}`,
      referrer,
      referrer_path: referrerPath,
      page_title: document.title,
      locale: navigator.language,
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
      session_id: getSessionId(),
      client_timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/book/visit-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        keepalive: true,
        body: JSON.stringify({
          event_name: eventName,
          device_id: deviceId,
          is_returning: visitCount > 1,
          visit_count: visitCount,
          payload,
        }),
      });

      if (response.ok) return;
    } catch {
      // Fallback below.
    }

    await supabase.from('visit_logs').insert([
      {
        device_id: deviceId,
        event_name: eventName,
        is_returning: visitCount > 1,
        visit_count: visitCount,
        payload,
      },
    ]);
  } catch (error) {
    console.warn('[Telemetry Warning] Failed to log event:', error);
  }
}
