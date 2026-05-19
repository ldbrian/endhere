'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import html2canvas from 'html2canvas'
import { track } from '../lib/track'

// 保留作为旧档案数据的兼容或兜底
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

function getStatusByScore(score: number) {
  if (score >= 8) return { label: '还在痛', color: '#e87070' }
  if (score >= 5) return { label: '好一点了', color: 'var(--warm-yellow)' }
  if (score >= 3) return { label: '快放下了', color: '#a0c4a0' }
  return { label: '到此为止', color: 'var(--text-muted)' }
}

export default function DonePage() {
  const [item, setItem] = useState<{ id: string; icon: string; name: string; desc: string } | null>(null)
  const [visible, setVisible] = useState(false)
  const [scoreEnd, setScoreEnd] = useState(5)
  const [saved, setSaved] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 1. 从本地存储中，精准读取刚刚在前一个页面写入的最新一条档案
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    
    if (entries.length > 0 && entries[0].destinedItem) {
      const dItem = entries[0].destinedItem
      
      // 根据 AI 实时定制的 ID 映射对应的物理 Emoji 图标
      const getItemIcon = (id: string) => {
        if (id === 'broken_scale') return '⚖️'
        if (id === 'cracked_bowl') return '🥣'
        return '⚓'
      }

      // 将前一页定制的专属命运物件，无缝无感地同步到结算单据上
      setItem({
        id: dItem.id,
        icon: getItemIcon(dItem.id),
        name: dItem.name,
        desc: dItem.desc
      })
    } else {
      // 2. 如果由于用户刷新等极个别情况没拿到，采用原有静态集合进行兜底防崩
      const random = ITEMS[Math.floor(Math.random() * ITEMS.length)]
      setItem(random)
    }

    setTimeout(() => setVisible(true), 100)
  }, [])

  const handleSave = () => {
    track('save_entry', { scoreEnd, item_id: item?.id })
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    if (entries.length > 0) {
      entries[0].emotionEnd = scoreEnd
      entries[0].status = getStatusByScore(scoreEnd).label
      // 将当前最终确认的定制物件更新至历史记录的经典 item 字段，保证历史页面读取绝对安全
      entries[0].item = item
    }
    localStorage.setItem('entries', JSON.stringify(entries))
    setSaved(true)
  }

  const handleShare = async () => {
    track('share_card')
    if (isSharing) return
    setIsSharing(true)
    
    try {
      const element = document.getElementById('share-receipt')
      if (!element) return

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        logging: false,
      } as any)
      
      const imgData = canvas.toDataURL('image/png')

      const downloadImage = (dataUrl: string) => {
        const link = document.createElement('a')
        link.download = `EndHere-Receipt-${new Date().getTime()}.png`
        link.href = dataUrl
        link.click()
      }

      if (navigator.share) {
        try {
          const blob = await (await fetch(imgData)).blob()
          const file = new File([blob], 'end-here-receipt.png', { type: 'image/png' })
          await navigator.share({
            title: '我的情绪小票',
            text: '一切到此为止。',
            files: [file]
          })
        } catch (err) {
          console.log('原生分享中止，降级为下载', err)
          downloadImage(imgData)
        }
      } else {
        downloadImage(imgData)
      }
    } catch (error) {
      console.error('截图生成失败', error)
      alert('生成卡片失败，请稍后再试。')
    } finally {
      setIsSharing(false)
    }
  }

  const status = getStatusByScore(scoreEnd)

  return (
    <div style={{
      width: '100%',
      maxWidth: '360px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '32px',
      padding: '40px 24px',
      textAlign: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.8s ease',
      margin: '0 auto',
    }}>

      {/* --- 将需要被截图的区域统一包裹为“情绪小票” --- */}
      <div id="share-receipt" style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
        padding: '32px 24px',
        background: '#121212', 
        borderRadius: '16px',
        border: saved ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}>
        
        {/* 顶部指示线 */}
        <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />

        {/* 收尾文案 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.3em' }}>已记录</p>
          <h2 style={{
            color: 'var(--text-main)', fontSize: '26px',
            fontWeight: '300', letterSpacing: '0.15em', lineHeight: '1.8',
          }}>
            到此为止。
          </h2>
        </div>

        {/* 虚拟物件区：完美复刻前一页大模型当场打印的那枚带刺收据 */}
        {item && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            padding: '28px', borderRadius: '16px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            width: '100%',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 1.2s ease, transform 1.2s ease',
            transitionDelay: '0.4s',
          }}>
            <div style={{
              fontSize: '48px', lineHeight: 1,
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1)' : 'scale(0.8)',
              transition: 'opacity 1s ease, transform 1s ease',
              transitionDelay: '0.8s',
            }}>
              {item.icon}
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '6px',
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.8s ease',
              transitionDelay: '1.2s',
            }}>
              <p style={{ color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.15em' }}>
                收下「{item.name}」
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.8', opacity: 0.8 }}>
                {item.desc}
              </p>
            </div>
          </div>
        )}

        {/* 水印区域 */}
        {saved && (
          <div style={{
            marginTop: '8px',
            paddingTop: '20px',
            borderTop: '1px dashed rgba(255,255,255,0.1)',
            width: '88%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: 0.8,
          }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em' }}>End Here</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '6px', opacity: 0.6, letterSpacing: '0.05em' }}>深夜情绪便利店</p>
            </div>
            
            <div style={{
              width: '44px', height: '44px', background: '#fff', padding: '2px', borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <img 
                src="/qrcode.png" 
                alt="二维码" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                crossOrigin="anonymous" 
              />
            </div>
          </div>
        )}
      </div>
      {/* --- 截图区域结束 --- */}

      {/* 结束情绪评分 */}
      {!saved && (
        <div style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: '16px',
          padding: '24px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>
            现在感觉怎么样了？
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>难受程度</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: status.color, fontSize: '11px', letterSpacing: '0.1em' }}>
                {status.label}
              </span>
              <span style={{ color: 'var(--warm-yellow)', fontSize: '20px', fontWeight: '300' }}>
                {scoreEnd}
              </span>
            </div>
          </div>
          <input
            type="range" min={1} max={10} value={scoreEnd}
            onChange={(e) => setScoreEnd(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--warm-yellow)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>好多了</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>很难受</span>
          </div>
          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '13px', borderRadius: '10px',
              border: '1px solid rgba(245,200,66,0.3)',
              background: 'rgba(245,200,66,0.08)',
              color: 'var(--warm-yellow)', fontSize: '13px',
              letterSpacing: '0.2em', cursor: 'pointer',
            }}
          >
            收入档案
          </button>
        </div>
      )}

      {/* 操作区 */}
      {saved && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleShare}
            disabled={isSharing}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: '1px solid rgba(245,200,66,0.6)', 
              background: 'var(--warm-yellow)',
              color: '#1a1a1a', fontSize: '14px', fontWeight: 'bold',
              letterSpacing: '0.15em', cursor: 'pointer',
              opacity: isSharing ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {isSharing ? '生成中...' : '保存 / 分享小票'}
          </button>

          <button
            onClick={() => router.push('/archive')}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: '13px',
              letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            查看我的档案
          </button>

          <button
            onClick={() => router.push('/')}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: '1px solid rgba(245,200,66,0.2)', background: 'transparent',
              color: 'var(--warm-yellow)', fontSize: '13px',
              letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.7,
            }}
          >
            回到开始
          </button>
        </div>
      )}

    </div>
  )
}