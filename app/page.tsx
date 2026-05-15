'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EMOTIONS = [
  { id: 'regret', label: '后悔', emoji: '😔' },
  { id: 'grievance', label: '委屈', emoji: '🥺' },
  { id: 'unwilling', label: '不甘', emoji: '😤' },
  { id: 'irritated', label: '烦躁', emoji: '😣' },
  { id: 'sad', label: '难过', emoji: '😢' },
]

export default function Home() {
  const [selected, setSelected] = useState<string | null>(null)
  const router = useRouter()

  const handleEnter = () => {
    if (!selected) return
    router.push(`/write?emotion=${selected}`)
  }

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', padding: '60px 24px' }}>
      
      {/* 暖光晕 */}
      <div
        style={{
          position: 'fixed',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(245,200,66,0.07) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* 主文案 */}
      <div className="text-center flex flex-col gap-4">
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            letterSpacing: '0.35em',
          }}
        >
          END HERE
        </p>
        <h1
          style={{
            color: 'var(--text-main)',
            fontSize: '32px',
            fontWeight: '300',
            letterSpacing: '0.15em',
            lineHeight: '1.8',
          }}
        >
          写下来。
          <br />
          到此为止。
        </h1>
      </div>

      {/* 分隔线 */}
      <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />

      {/* 情绪选择 */}
      <div className="w-full flex flex-col gap-5">
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '12px',
            textAlign: 'center',
            letterSpacing: '0.15em',
          }}
        >
          现在的感觉是
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {EMOTIONS.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              style={{
                padding: '9px 22px',
                borderRadius: '999px',
                border: `1px solid ${selected === e.id ? 'var(--warm-yellow)' : 'var(--border)'}`,
                background: selected === e.id ? 'rgba(245,200,66,0.1)' : 'transparent',
                color: selected === e.id ? 'var(--warm-yellow)' : 'var(--text-muted)',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              {e.emoji} {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* 进入按钮 */}
      <div className="w-full flex flex-col items-center gap-4">
        <button
          onClick={handleEnter}
          disabled={!selected}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '12px',
            border: `1px solid ${selected ? 'rgba(245,200,66,0.3)' : 'var(--border)'}`,
            background: selected ? 'rgba(245,200,66,0.08)' : 'transparent',
            color: selected ? 'var(--warm-yellow)' : 'var(--text-muted)',
            fontSize: '14px',
            letterSpacing: '0.2em',
            cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease',
            opacity: selected ? 1 : 0.4,
          }}
        >
          写下来
        </button>

        {/* 底部说明 */}
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            textAlign: 'center',
            lineHeight: '2',
            opacity: 0.5,
            letterSpacing: '0.05em',
          }}
        >
          你的日记只存在你的设备上 · 无需注册
        </p>
      </div>

    </div>
  )
}