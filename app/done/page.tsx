'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import html2canvas from 'html2canvas'
import { track } from '../lib/track'

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
  const [item, setItem] = useState<typeof ITEMS[0] | null>(null)
  const [visible, setVisible] = useState(false)
  const [scoreEnd, setScoreEnd] = useState(5)
  const [saved, setSaved] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  
  // === 新增：无需账号的流水号对账系统 ===
  const [receiptId, setReceiptId] = useState('')
  const [inputCode, setInputCode] = useState('')
  
  const router = useRouter()

  useEffect(() => {
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    
    if (entries.length > 0 && entries[0].destinedItem) {
      const dItem = entries[0].destinedItem
      const getItemIcon = (id: string) => {
        if (id === 'broken_scale') return '⚖️'
        if (id === 'cracked_bowl') return '🥣'
        return '⚓'
      }
      setItem({
        id: dItem.id,
        icon: getItemIcon(dItem.id),
        name: dItem.name,
        desc: dItem.desc
      })
    } else {
      const random = ITEMS[Math.floor(Math.random() * ITEMS.length)]
      setItem(random)
    }

    // 动态生成本张小票唯一的赛博流水号（取当前时间戳后四位，配上随机大写字母）
    const randStr = Math.random().toString(36).substring(2, 4).toUpperCase()
    const timestampStr = Date.now().toString().slice(-4)
    setReceiptId(`EH-${randStr}${timestampStr}`)

    setTimeout(() => setVisible(true), 100)
  }, [])

  const handleSave = () => {
    track('save_entry', { scoreEnd, item_id: item?.id })
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    if (entries.length > 0) {
      entries[0].emotionEnd = scoreEnd
      entries[0].status = getStatusByScore(scoreEnd).label
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

  // === 处理暗号激活逻辑 ===
  const handleActivateCode = () => {
    const cleanCode = inputCode.trim().toUpperCase()
    if (!cleanCode) return

    // 规则A：如果输入的代码完全匹配当前小票流水号
    if (cleanCode === receiptId) {
      localStorage.setItem('extra_limit_granted', '3') // 本地追加3次临时额度
      alert('🔋 情绪能量包激活成功！感谢支持，今日可额外发泄 3 次。')
      setInputCode('')
    } 
    // 规则B：如果你给长期赞助者预设的永恒终身暗号
    else if (cleanCode === 'FOREVER2026') {
      localStorage.setItem('is_lifetime_vip', 'true')
      alert('👑 VIP 终身特权激活！感谢你成为深夜小店的长期电费合伙人！')
      setInputCode('')
    } else {
      alert('❓ 暗号对不上，检查一下转账备注或者小票底部是否有打错？')
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

      {/* --- 需要被截图的情绪小票区域 --- */}
      <div id="share-receipt" style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '32px', padding: '32px 24px', background: '#121212', 
        borderRadius: '16px', border: saved ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}>
        
        <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.3em' }}>已记录</p>
          <h2 style={{ color: 'var(--text-main)', fontSize: '26px', fontWeight: '300', letterSpacing: '0.15em', lineHeight: '1.8' }}>
            到此为止。
          </h2>
        </div>

        {item && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            padding: '28px', borderRadius: '16px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            width: '100%', opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 1.2s ease, transform 1.2s ease', transitionDelay: '0.4s',
          }}>
            <div style={{
              fontSize: '48px', lineHeight: 1, opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1)' : 'scale(0.8)',
              transition: 'opacity 1s ease, transform 1s ease', transitionDelay: '0.8s',
            }}>
              {item.icon}
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '6px', opacity: visible ? 1 : 0,
              transition: 'opacity 0.8s ease', transitionDelay: '1.2s',
            }}>
              <p style={{ color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.15em' }}>获得「{item.name}」</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.8', opacity: 0.8 }}>{item.desc}</p>
            </div>
          </div>
        )}

        {/* 水印区域 & 赛博流水号展示 */}
        {saved && (
          <div style={{
            marginTop: '8px', paddingTop: '20px', borderTop: '1px dashed rgba(255,255,255,0.1)',
            width: '88%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8, 
          }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em' }}>End Here</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '4px', opacity: 0.5, letterSpacing: '0.05em' }}>深夜情绪便利店</p>
              {/* 核心改动：把流水号打印在小票最底部，极度逼真 */}
              <p style={{ color: 'var(--warm-yellow)', fontFamily: 'monospace', fontSize: '10px', marginTop: '8px', opacity: 0.8, letterSpacing: '0.05em' }}>
                流水号: #{receiptId}
              </p>
            </div>
            
            <div style={{
              width: '44px', height: '44px', background: '#fff', padding: '2px', borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <img src="/qrcode.png" alt="二维码" style={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
            </div>
          </div>
        )}
      </div>

      {/* 结束情绪评分 */}
      {!saved && (
        <div style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: '16px',
          padding: '24px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>现在感觉怎么样了？</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>难受程度</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: status.color, fontSize: '11px', letterSpacing: '0.1em' }}>{status.label}</span>
              <span style={{ color: 'var(--warm-yellow)', fontSize: '20px', fontWeight: '300' }}>{scoreEnd}</span>
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
              width: '100%', padding: '13px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.3)',
              background: 'rgba(245,200,66,0.08)', color: 'var(--warm-yellow)', fontSize: '13px',
              letterSpacing: '0.2em', cursor: 'pointer',
            }}
          >
            收入档案
          </button>
        </div>
      )}

      {/* 收入后显示的操作区与收银台 */}
      {saved && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* === 🏪 深夜小店收银台 === */}
          <div style={{
            width: '100%', padding: '20px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(245,200,66,0.15)',
            textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '8px'
          }}>
            <p style={{ color: 'var(--warm-yellow)', fontSize: '12px', letterSpacing: '0.1em', fontWeight: 'bold' }}>
              🏪 深夜小店收银台 (支持店长用爱发电)
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.6', opacity: 0.7 }}>
              小店全凭自愿赞助。如果你被接住了，可以为服务器续点电费。赞助时请在转账备注中写下当前小票底部的流水号：<span style={{ color: 'var(--warm-yellow)', fontFamily: 'monospace' }}>#{receiptId}</span>。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div onClick={() => alert(`赞助备注请写：【打赏 + ${receiptId}】\n感谢你请店长喝水，这能让避难所的坏灯泡多亮一晚。`)} style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-main)', fontSize: '12px' }}>☕ 请店长喝瓶水</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>随缘 ￥Any</span>
              </div>
              <div onClick={() => alert(`购买能量包备注请严格填写：【能量包 + ${receiptId}】\n\n转账后，直接在下方输入框内填入小票流水号即可立即激活！`)} style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-main)', fontSize: '12px' }}>🔋 购买情绪能量包 (今日额外对线3次)</span>
                <span style={{ color: 'var(--warm-yellow)', fontSize: '12px', fontWeight: 'bold' }}>￥4.9</span>
              </div>
              <div onClick={() => alert(`成为合伙人备注请严格填写：【长期电费 + ${receiptId}】\n\n店长看到后会通过平台私信，向你发送永久通关暗号。`)} style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(245,200,66,0.03)', border: '1px solid rgba(245,200,66,0.2)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--warm-yellow)', fontSize: '12px', fontWeight: 'bold' }}>👑 长期赞助小店电费 (永久无限次)</span>
                <span style={{ color: 'var(--warm-yellow)', fontSize: '12px', fontWeight: 'bold' }}>￥19.9</span>
              </div>
            </div>

            {/* 无感激活暗号输入框 */}
            <div style={{ marginTop: '4px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.05)', display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={inputCode}
                placeholder="输入激活暗号或当前小票流水号..." 
                onChange={(e) => setInputCode(e.target.value)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                  color: 'var(--text-main)', fontSize: '11px', textAlign: 'center',
                  outline: 'none', letterSpacing: '0.05em'
                }}
              />
              <button 
                onClick={handleActivateCode}
                style={{
                  padding: '0 16px', borderRadius: '6px',
                  background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)',
                  color: 'var(--warm-yellow)', fontSize: '11px', cursor: 'pointer'
                }}
              >
                激活
              </button>
            </div>
          </div>

          <button
            onClick={handleShare}
            disabled={isSharing}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(245,200,66,0.6)', 
              background: 'var(--warm-yellow)', color: '#1a1a1a', fontSize: '14px', fontWeight: 'bold',
              letterSpacing: '0.15em', cursor: 'pointer', opacity: isSharing ? 0.7 : 1, transition: 'opacity 0.2s',
            }}
          >
            {isSharing ? '生成中...' : '保存 / 分享小票'}
          </button>

          <button
            onClick={() => router.push('/archive')}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            查看我的档案
          </button>

          <button
            onClick={() => router.push('/')}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(245,200,66,0.2)', background: 'transparent',
              color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.7,
            }}
          >
            回到开始
          </button>
        </div>
      )}

    </div>
  )
}