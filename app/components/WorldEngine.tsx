'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function WorldEngine() {
  const [activeEvent, setActiveEvent] = useState<'clear' | 'rain' | 'broken_bulb'>('clear')

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