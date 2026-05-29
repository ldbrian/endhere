'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '../lib/track' // 引入已有的打点器

export default function SitPage() {
  const [line, setLine] = useState('')
  const [fade, setFade] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 1. 记录用户坐下的时间
    const enterTime = Date.now()

    // 极低频的事件，拉长现实体感
    const events = [
      '空调滴水声停了。',
      '窗外有摩托车经过。',
      '你动了一下手指。',
      '什么也没发生。',
      '收音机杂音里闪过半句歌词。',
      '远处有猫叫了一声。',
      '灯管微微闪了一下。',
    ]
    
    let index = 0
    let isActive = true

    const triggerNext = () => {
      if (!isActive) return

      // 先暗场
      setFade(false)
      
      setTimeout(() => {
        if (!isActive) return
        
        // 核心修复：采用取模运算(%)，让数组无限循环，绝不自动踢出用户
        setLine(events[index % events.length])
        setFade(true)
        index++
      }, 1500)
    }

    // 进页面 1秒 后出现第一句
    setTimeout(triggerNext, 1000)
    // 之后每 6秒 调度一次 (1.5秒暗场 + 4.5秒展示)
    const interval = setInterval(triggerNext, 6000)

    const handleClick = () => {
      setFade(false) // 点击时先黑屏再退出，更柔和
      setTimeout(() => router.push('/'), 600)
    }
    
    window.addEventListener('click', handleClick)

    return () => {
      isActive = false
      clearInterval(interval)
      window.removeEventListener('click', handleClick)

      // 2. 核心新增：用户主动离开时，上报发呆时长（转换为秒）
      const stayDuration = Math.round((Date.now() - enterTime) / 1000)
      track('stay_duration', { page: 'sit', duration_seconds: stayDuration })
    }
  }, [router])

  return (
    <div
      style={{
        background: '#0a0908', // 比大厅更深的纯黑
        height: '100dvh',
        width: '100vw',        // 强制全屏宽度
        maxWidth: 'none',      // 突破可能的父级限制
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"PingFang SC", "Hiragino Sans GB", sans-serif',
        flexDirection: 'column',
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden'
      }}
    >
      {/* 物理环境底层：CRT 扫描线与灰尘噪点 */}
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.04) 3px,rgba(0,0,0,0.04) 4px)', pointerEvents: 'none', zIndex: 1 }}></div>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.1, mixBlendMode: 'screen', pointerEvents: 'none', zIndex: 2, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")' }}></div>

      {/* 视觉重心区 */}
      <div style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', width: '100%', padding: '0 24px' }}>
        
        <div style={{ opacity: 0.25, color: '#8f857a', fontSize: '10px', letterSpacing: '0.3em', fontFamily: 'monospace' }}>
          [ 你坐在角落的破木凳上 ]
        </div>
        
        {/* 动态呼吸文本 */}
        <div
          style={{
            minHeight: '40px',
            textAlign: 'center',
            fontSize: '13px',
            letterSpacing: '0.2em',
            color: '#d4cdb3',
            opacity: fade ? 0.8 : 0,
            transform: fade ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 1.5s ease, transform 1.5s ease',
            textShadow: '0 2px 10px rgba(255,255,255,0.1)'
          }}
        >
          {line}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '8vh',
          fontSize: '9px',
          letterSpacing: '0.2em',
          color: '#8f857a',
          opacity: 0.15,
          animation: 'pulseLeave 3s infinite',
          zIndex: 10
        }}
      >
        点击任意位置离开
      </div>

      <style>{`
        @keyframes pulseLeave { 
          0%, 100% { opacity: 0.1; } 
          50% { opacity: 0.3; } 
        }
      `}</style>
    </div>
  )
}