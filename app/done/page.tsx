'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const ITEMS = [
  { id: 'candle', icon: '🕯️', name: '深夜的烛光', desc: '你在最黑的时候，还是点了一盏灯。' },
  { id: 'rain', icon: '🌧️', name: '一场及时的雨', desc: '有些事，需要被冲刷一遍才能继续。' },
  { id: 'tea', icon: '🍵', name: '冷掉的茶', desc: '你顾着难过，忘了喝。没关系。' },
  { id: 'ticket', icon: '🎫', name: '一张旧车票', desc: '到站了。这段路，到此为止。' },
  { id: 'stone', icon: '🪨', name: '一块普通的石头', desc: '它什么都不做，但它在。' },
  { id: 'letter', icon: '✉️', name: '没寄出的信', desc: '有些话说了就够了，不需要送达。' },
  { id: 'moon', icon: '🌙', name: '凌晨三点的月亮', desc: '它见过很多人的难熬，你不是第一个。' },
  { id: 'match', icon: '🔥', name: '一根火柴', desc: '划亮过，就够了。' },
]

export default function DonePage() {
  const [item, setItem] = useState<typeof ITEMS[0] | null>(null)
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 随机分配一个物件
    const random = ITEMS[Math.floor(Math.random() * ITEMS.length)]
    setItem(random)
    setTimeout(() => setVisible(true), 300)
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
      transition: 'opacity 0.8s ease',
    }}>

      {/* 分隔线 */}
      <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />

      {/* 收尾文案 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '12px',
          letterSpacing: '0.3em',
        }}>
          已记录
        </p>
        <h2 style={{
          color: 'var(--text-main)',
          fontSize: '26px',
          fontWeight: '300',
          letterSpacing: '0.15em',
          lineHeight: '1.8',
        }}>
          到此为止。
        </h2>
      </div>

      {/* 虚拟物件 */}
      {item && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '32px 28px',
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          width: '100%',
        }}>
          <div style={{ fontSize: '48px', lineHeight: 1 }}>
            {item.icon}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{
              color: 'var(--warm-yellow)',
              fontSize: '14px',
              letterSpacing: '0.1em',
            }}>
              获得「{item.name}」
            </p>
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '13px',
              lineHeight: '1.8',
              opacity: 0.8,
            }}>
              {item.desc}
            </p>
          </div>
        </div>
      )}

      {/* 今晚比昨晚轻一点 */}
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '13px',
        lineHeight: '2',
        opacity: 0.6,
        letterSpacing: '0.05em',
      }}>
        比刚才轻一点了吗？
      </p>

      {/* 按钮组 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={() => router.push('/archive')}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '13px',
            letterSpacing: '0.15em',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          查看我的档案
        </button>
        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid rgba(245,200,66,0.2)',
            background: 'transparent',
            color: 'var(--warm-yellow)',
            fontSize: '13px',
            letterSpacing: '0.15em',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            opacity: 0.7,
          }}
        >
          回到开始
        </button>
      </div>

    </div>
  )
}