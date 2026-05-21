'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { track } from './lib/track'

const EMOTIONS = [
  { id: 'choke', label: '胸口堵得慌', emoji: '😮‍💨' },
  { id: 'tear', label: '眼眶有点热', emoji: '🥺' },
  { id: 'numb', label: '整个人木木的', emoji: '🫥' },
  { id: 'angry', label: '心里有股无名火', emoji: '🔥' },
  { id: 'shattered', label: '感觉快碎掉了', emoji: '🩹' },
]

export default function Home() {
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(7)
  const [isBulbFixed, setIsBulbFixed] = useState(false)
  
  // === 新增：店长状态指示灯 ===
  const [managerStatus, setManagerStatus] = useState('● 确认店长状态中...')
  const [statusColor, setStatusColor] = useState('var(--text-muted)')

  const router = useRouter()

  useEffect(() => {
    // 检查换灯泡赞助
    if (localStorage.getItem('fixed_light') === 'true' || localStorage.getItem('is_lifetime_vip') === 'true') {
      setIsBulbFixed(true)
    }

    // === 新增：根据时间自动判断店长在干嘛 ===
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 18) {
      setManagerStatus('● 店长跑车挣电费中，暂由 AI 看店')
      setStatusColor('var(--text-muted)') // 熄灯灰
    } else if (hour >= 18 && hour < 23) {
      setManagerStatus('● 店长补觉中，晚点亲自营业')
      setStatusColor('#a0c4a0') // 补觉绿
    } else {
      setManagerStatus('● 店长已深夜上线，吧台可压小票')
      setStatusColor('var(--warm-yellow)') // 营业暖黄
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
      padding: '40px 24px 60px', // 顶部留出一点空间给状态灯
    }}>

      <div style={{
        position: 'fixed', top: '35%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(245,200,66,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* === 新增：悬浮在最顶部的店长状态牌 === */}
      <div style={{
        padding: '6px 16px',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '-10px'
      }}>
        <span style={{ color: statusColor, fontSize: '12px', transition: 'color 1s ease' }}>{managerStatus.charAt(0)}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.05em' }}>{managerStatus.slice(2)}</span>
      </div>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <img
          src="/logo.png"
          alt="End Here"
          className={isBulbFixed ? "" : "flicker-bulb"}
          style={{ width: '72px', height: '72px', opacity: 0.9 }}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.35em' }}>
          END HERE
        </p>
        <h1 
          className={isBulbFixed ? "" : "flicker-bulb"}
          style={{
            color: 'var(--text-main)', fontSize: '32px',
            fontWeight: '300', letterSpacing: '0.15em', lineHeight: '1.8',
          }}>
          写下来 到此为止
        </h1>
      </div>

      <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', letterSpacing: '0.15em' }}>
          现在的真实感觉是
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          {EMOTIONS.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              style={{
                width: '100%',
                padding: '12px 20px', 
                borderRadius: '999px',
                border: `1px solid ${selected === e.id ? 'var(--warm-yellow)' : 'var(--border)'}`,
                background: selected === e.id ? 'rgba(245,200,66,0.1)' : 'transparent',
                color: selected === e.id ? 'var(--warm-yellow)' : 'var(--text-muted)',
                fontSize: '13px', 
                cursor: 'pointer', 
                transition: 'all 0.25s ease',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ letterSpacing: '0.05em' }}>{e.label}</span>
              <span style={{ fontSize: '15px' }}>{e.emoji}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>
              这股感觉有多重
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
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>已经满了</span>
          </div>
        </div>
      )}

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