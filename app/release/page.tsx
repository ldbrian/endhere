'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReleasePage() {
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  return (
    <div style={{
      width: '100%',
      maxWidth: '360px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '40px',
      padding: '80px 24px',
      textAlign: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 1.2s ease',
    }}>

      {/* 核心仪式 */}
      <div style={{
        fontSize: '52px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.8)',
        transition: 'opacity 1.5s ease, transform 1.5s ease',
        transitionDelay: '0.3s',
      }}>
        🕊️
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{
          color: 'var(--text-main)',
          fontSize: '24px',
          fontWeight: '300',
          letterSpacing: '0.2em',
          lineHeight: '1.8',
          opacity: visible ? 1 : 0,
          transition: 'opacity 1s ease',
          transitionDelay: '0.8s',
        }}>
          放下了。
        </h2>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '13px',
          lineHeight: '2',
          opacity: visible ? 0.7 : 0,
          transition: 'opacity 1s ease',
          transitionDelay: '1.2s',
          letterSpacing: '0.05em',
        }}>
          它还在档案里，只是不再需要被处理了。
          <br />
          你经历了它，然后继续走了。
        </p>
      </div>

      <div style={{
        width: '40px', height: '1px', background: 'var(--border)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease',
        transitionDelay: '1.5s',
      }} />

      <button
        onClick={() => router.push('/archive')}
        style={{
          padding: '14px 32px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: '13px',
          letterSpacing: '0.15em',
          cursor: 'pointer',
          opacity: visible ? 0.7 : 0,
          transition: 'opacity 1s ease',
          transitionDelay: '1.8s',
        }}
      >
        回到档案
      </button>

    </div>
  )
}