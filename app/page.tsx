'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { track } from './lib/track'

const EMOTIONS = [
  { id: 'regret', label: '后悔', emoji: '😔' },
  { id: 'grievance', label: '委屈', emoji: '🥺' },
  { id: 'unwilling', label: '不甘', emoji: '😤' },
  { id: 'irritated', label: '烦躁', emoji: '😣' },
  { id: 'sad', label: '难过', emoji: '😢' },
]

export default function Home() {
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(7)
  const [isBulbFixed, setIsBulbFixed] = useState(false) // 记录是否换过灯泡
  const router = useRouter()

  // 页面加载时，检查本地是否赞助换过灯泡
  useEffect(() => {
    if (localStorage.getItem('fixed_light') === 'true') {
      setIsBulbFixed(true)
    }
  }, [])

  const handleEnter = () => {
    if (!selected) return
    track('enter_write', { emotion: selected, score })
    sessionStorage.setItem('emotion_score', String(score))
    router.push(`/write?emotion=${selected}`)
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '360px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '40px',
      padding: '60px 24px',
    }}>

      <div style={{
        position: 'fixed', top: '35%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(245,200,66,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* 主文案 */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <img
          src="/logo.png"
          alt="End Here"
          className={isBulbFixed ? "" : "flicker-bulb"} /* 没修灯泡就闪烁 */
          style={{ width: '72px', height: '72px', opacity: 0.9 }}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.35em' }}>
          END HERE
        </p>
        <h1 
          className={isBulbFixed ? "" : "flicker-bulb"} /* 没修灯泡就闪烁 */
          style={{
            color: 'var(--text-main)', fontSize: '32px',
            fontWeight: '300', letterSpacing: '0.15em', lineHeight: '1.8',
          }}>
          写下来 到此为止
        </h1>
      </div>

      <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />

      {/* 情绪选择 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', letterSpacing: '0.15em' }}>
          现在的感觉是
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
          {EMOTIONS.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              style={{
                padding: '9px 22px', borderRadius: '999px',
                border: `1px solid ${selected === e.id ? 'var(--warm-yellow)' : 'var(--border)'}`,
                background: selected === e.id ? 'rgba(245,200,66,0.1)' : 'transparent',
                color: selected === e.id ? 'var(--warm-yellow)' : 'var(--text-muted)',
                fontSize: '14px', cursor: 'pointer', transition: 'all 0.25s ease',
              }}
            >
              {e.emoji} {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* 情绪滑块 */}
      {selected && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>
              现在有多难受
            </p>
            <p style={{ color: 'var(--warm-yellow)', fontSize: '20px', fontWeight: '300' }}>
              {score}
            </p>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={score}
            onChange={(e) => setScore(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--warm-yellow)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>还好</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>很难受</span>
          </div>
        </div>
      )}

      {/* 进入按钮 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={handleEnter}
          disabled={!selected}
          style={{
            width: '100%', padding: '15px', borderRadius: '12px',
            border: `1px solid ${selected ? 'rgba(245,200,66,0.3)' : 'var(--border)'}`,
            background: selected ? 'rgba(245,200,66,0.08)' : 'transparent',
            color: selected ? 'var(--warm-yellow)' : 'var(--text-muted)',
            fontSize: '14px', letterSpacing: '0.2em',
            cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease', opacity: selected ? 1 : 0.4,
          }}
        >
          写下来
        </button>

        {/* 档案入口 */}
        <button
          onClick={() => router.push('/archive')}
          style={{
            width: '100%', padding: '12px', borderRadius: '12px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: '12px',
            letterSpacing: '0.15em', cursor: 'pointer',
            transition: 'all 0.3s ease', opacity: 0.6,
          }}
        >
          查看我的档案
        </button>

        <p style={{
          color: 'var(--text-muted)', fontSize: '11px',
          textAlign: 'center', lineHeight: '2', opacity: 0.5,
        }}>
          你的日记只存在你的设备上 · 无需注册
        </p>
      </div>

    </div>
  )
}