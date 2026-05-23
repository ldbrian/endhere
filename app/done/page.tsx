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
  { id: 'moon', icon: '🌙', name: '凌晨三点的月亮', desc: '它见过很多人的难熬，你不是第一个。' },
  { id: 'match', icon: '🔥', name: '一根火柴', desc: '划亮过，就够了。' },
]

export default function DonePage() {
  const [item, setItem] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [scoreEnd, setScoreEnd] = useState(5)
  const [saved, setSaved] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [receiptId, setReceiptId] = useState('')
  const [isManagerMode, setIsManagerMode] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    const currentEntry = entries[0]
    
    // 生成唯一的接头流水号
    const randStr = Math.random().toString(36).substring(2, 4).toUpperCase()
    const timestampStr = Date.now().toString().slice(-4)
    const newReceiptId = `EH-${randStr}${timestampStr}`
    setReceiptId(newReceiptId)

    if (currentEntry) {
      if (currentEntry.persona === 'Manager') {
        setIsManagerMode(true)
        setItem({ 
          id: 'manager_letter', 
          icon: '✉️', 
          name: '一封未读的留言', 
          desc: '它正安静地躺在吧台抽屉里，等待被店长拆开。' 
        })
      } else {
        if (currentEntry.destinedItem) {
          const dItem = currentEntry.destinedItem
          setItem({ id: dItem.id, icon: dItem.id === 'broken_scale' ? '⚖️' : (dItem.id === 'cracked_bowl' ? '🥣' : '⚓'), name: dItem.name, desc: dItem.desc })
        } else {
          setItem(ITEMS[Math.floor(Math.random() * ITEMS.length)])
        }
      }
    }

    setTimeout(() => setVisible(true), 100)
  }, [])

  const handleSave = () => {
    track('save_entry', { scoreEnd, item_id: item?.id })
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    if (entries.length > 0) {
      entries[0].emotionEnd = scoreEnd
      entries[0].status = isManagerMode ? '未投递' : '已封存' // 👈 核心修复 2
      entries[0].item = item
      entries[0].receiptId = receiptId 
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
        backgroundColor: '#1a1612' 
      } as any)
      const imgData = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `EndHere-${receiptId}.png`
      link.href = imgData
      link.click()
    } catch (error) { 
      alert('小票打印机卡纸了，请稍后再试。') 
    } finally { 
      setIsSharing(false) 
    }
  }

  return (
    <div style={{
      width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '28px', padding: '50px 20px',
      opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease', margin: '0 auto',
    }}>

      {/* 🧾 === 真实热敏纸实体小票区域 === */}
      <div id="share-receipt" style={{
        width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', 
        padding: '36px 24px 40px', 
        background: '#fbfaf7', 
        color: '#2a2a2a', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 5px 15px rgba(0,0,0,0.2)',
        position: 'relative',
        fontFamily: 'monospace, "PingFang SC"',
        clipPath: 'polygon(0% 0%, 4% 2%, 8% 0%, 12% 2%, 16% 0%, 20% 2%, 24% 0%, 28% 2%, 32% 0%, 36% 2%, 40% 0%, 44% 2%, 48% 0%, 52% 2%, 56% 0%, 60% 2%, 64% 0%, 68% 2%, 72% 0%, 76% 2%, 80% 0%, 84% 2%, 88% 0%, 92% 2%, 96% 0%, 100% 2%, 100% 98%, 96% 100%, 92% 98%, 88% 100%, 84% 98%, 80% 100%, 76% 98%, 72% 100%, 68% 98%, 64% 100%, 60% 98%, 56% 100%, 52% 98%, 48% 100%, 44% 98%, 40% 100%, 36% 98%, 32% 100%, 28% 98%, 24% 100%, 20% 98%, 16% 100%, 12% 98%, 8% 100%, 4% 98%, 0% 100%)',
      }}>
        
        {/* 顶部伪造的物理条形码 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: 0.7 }}>
          <div style={{ 
            width: '140px', height: '24px', 
            backgroundImage: 'linear-gradient(90deg, #2a2a2a 0px, #2a2a2a 2px, transparent 2px, transparent 4px, #2a2a2a 4px, #2a2a2a 5px, transparent 5px, transparent 8px, #2a2a2a 8px, #2a2a2a 12px, transparent 12px, transparent 14px, #2a2a2a 14px, #2a2a2a 15px, transparent 15px, transparent 18px, #2a2a2a 18px, #2a2a2a 20px, transparent 20px, transparent 22px, #2a2a2a 22px, #2a2a2a 26px)',
            backgroundSize: '28px 24px'
          }} />
          <p style={{ fontSize: '9px', letterSpacing: '3px', margin: 0 }}>*{receiptId}*</p>
        </div>

        <div style={{ width: '100%', height: '1px', borderTop: '1px dashed #8c8273', opacity: 0.3 }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
          <p style={{ fontSize: '11px', color: '#8f857a', letterSpacing: '0.2em', margin: 0 }}>
            {isManagerMode ? 'COUNTER TICKET / 待投递' : 'MEMORIES RECORD / 已记录'}
          </p>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.05em', margin: '4px 0 0', color: '#1a1612' }}>
            {isManagerMode ? '凭条已打印。' : '一切到此为止。'}
          </h2>
        </div>

        {item && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '16px', borderRadius: '4px', background: 'rgba(0,0,0,0.02)', 
            border: '1px solid rgba(0,0,0,0.05)', width: '100%', textAlign: 'left'
          }}>
            <div style={{ fontSize: '36px', lineHeight: 1 }}>{item.icon}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <p style={{ color: '#1a1612', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>
                【{item.name}】
              </p>
              <p style={{ color: '#6e655f', fontSize: '11px', lineHeight: '1.5', margin: 0 }}>{item.desc}</p>
            </div>
          </div>
        )}

        <div style={{ width: '100%', height: '1px', borderTop: '1px dashed #8c8273', opacity: 0.3 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', textAlign: 'left' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0, color: '#1a1612' }}>END HERE 小店</p>
            <p style={{ fontSize: '9px', color: '#8f857a', marginTop: '2px', margin: 0 }}>
              时间: {new Date().toLocaleDateString('zh-CN')} {new Date().toLocaleTimeString('zh-CN', {hour12:false}).slice(0,5)}
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', marginTop: '6px', margin: 0, color: '#2a2a2a' }}>
              暗号: #{receiptId}
            </p>
          </div>
          
          {!isManagerMode && (
            <div style={{ width: '40px', height: '40px', background: '#fff', padding: '2px', border: '1px solid #e0e0e0', borderRadius: '2px' }}>
              <img src="/qrcode.png" alt="二维码" style={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
            </div>
          )}
        </div>
      </div>

      {!saved ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>撕下小票前，现在心情好点了吗？</p>
          <input type="range" min={1} max={10} value={scoreEnd} onChange={(e) => setScoreEnd(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--warm-yellow)', cursor: 'pointer' }} />
          <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.08)', color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 'bold' }}>
            盖章 · 撕下小票
          </button>
        </div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.3s ease' }}>
          <button
            onClick={() => router.push(`/counter?receiptId=${receiptId}&mode=${isManagerMode ? 'manager' : 'ai'}`)}
            style={{
              width: '100%', padding: '16px', borderRadius: '12px', 
              border: '1px dashed var(--warm-yellow)', 
              background: 'rgba(245,200,66,0.04)',
              color: 'var(--warm-yellow)', 
              fontSize: '13px', letterSpacing: '0.1em', cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isManagerMode ? '📥 去吧台把小票滑进玻璃糖罐...' : '🏪 去吧台看看旧货架和糖罐...'}
          </button>

          {!isManagerMode && (
            <button onClick={handleShare} disabled={isSharing} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(245,200,66,0.6)', background: 'var(--warm-yellow)', color: '#1a1a1a', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.15em', cursor: 'pointer' }}>
              {isSharing ? '正在裁切纸张...' : '保存实体小票图片'}
            </button>
          )}

          <button onClick={() => router.push('/archive')} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer' }}>
            查看我的情绪档案
          </button>
        </div>
      )}
    </div>
  )
}