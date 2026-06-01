'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useWorldEngine } from '../store/useWorldEngine' // <-- 引入状态机

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function WorldEngine() {
  const [activeEvent, setActiveEvent] = useState<'clear' | 'rain' | 'broken_bulb'>('clear')

  // 1. 原有的天气/环境查询引擎 (30秒轮询)
  useEffect(() => {
    const fetchState = async () => {
      try {
        const { data } = await supabase.from('world_state').select('event_type').eq('id', true).single()
        if (data) setActiveEvent(data.event_type as any)
      } catch (e) {}
    }
    fetchState()
    const interval = setInterval(fetchState, 30000)
    return () => clearInterval(interval)
  }, [])

  // 2. [P1 新增] 物理动作快照合并引擎 (5分钟心跳)
  useEffect(() => {
    const PULSE_RATE = 5 * 60 * 1000 // 5分钟
    
    const timer = setInterval(() => {
      useWorldEngine.getState().flushToWorld()
    }, PULSE_RATE)

    // 用户关掉网页前，强制把最后几分钟的动作送出去
    const handleBeforeUnload = () => {
      useWorldEngine.getState().flushToWorld()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // ==========================================
  // 下方的渲染逻辑完全保留你原来的版本，绝不破坏天气特效
  // ==========================================
  if (activeEvent === 'clear') return null

  return (
    <>
      {activeEvent === 'rain' && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998, background: 'linear-gradient(to bottom, rgba(10, 15, 25, 0.1), rgba(0, 0, 0, 0.15))', mixBlendMode: 'overlay' }} />
          <div style={{ position: 'fixed', bottom: '16px', left: '16px', pointerEvents: 'none', zIndex: 9999, color: '#6c8299', fontSize: '10px', letterSpacing: '0.2em', opacity: 0.5, fontFamily: 'monospace', animation: 'pulseWeather 4s infinite' }}>
            [ SYSTEM: RAINING ]
          </div>
        </>
      )}
      <style>{`
        @keyframes pulseWeather { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.6; } }
        body {
          ${activeEvent === 'rain' ? 'filter: sepia(0.2) hue-rotate(190deg) brightness(0.92);' : ''}
          ${activeEvent === 'broken_bulb' ? 'filter: brightness(0.8) contrast(1.1); animation: flickerEngine 8s infinite;' : ''}
          transition: filter 3s ease;
        }
        @keyframes flickerEngine {
          0%, 89%, 100% { filter: brightness(0.8) contrast(1.1); }
          90% { filter: brightness(0.65) contrast(1.0); }
          92% { filter: brightness(0.85) contrast(1.1); }
          94% { filter: brightness(0.7) contrast(1.0); }
          95% { filter: brightness(0.8) contrast(1.1); }
        }
      `}</style>
    </>
  )
}