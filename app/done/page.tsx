'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '../lib/track'

const ITEMS = [
  { id: 'candle', icon: '🕯️', name: '深夜的烛光', desc: '你在最黑的时候，还是点了一盏灯。' },
  { id: 'rain', icon: '🌧️', name: '一场及时的雨', desc: '有些事，需要被冲刷一遍才能继续。' },
  { id: 'tea', icon: '🍵', name: '冷掉的茶', desc: '你顾着难过，忘了喝。没关系。' },
  { id: 'ticket', icon: '🎫', name: '一张旧车票', desc: '到站了。这段路，到此为止。' },
  { id: 'stone', icon: '🪨', name: '一块普通的石头', desc: '它什么都不做，但它在。' },
  { id: 'moon', icon: '🌙', name: '凌晨三点的月亮', desc: '它见过很多人的难熬，你不是第一个。' },
]

export default function DonePage() {
  const [item, setItem] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [scoreEnd, setScoreEnd] = useState(5)
  const [saved, setSaved] = useState(false)
  const [receiptId, setReceiptId] = useState('')
  const [isManagerMode, setIsManagerMode] = useState(false)
  
  // 核心盲盒缓存（一旦取到，绝不流失，但也不进背包，只等待动作触发）
  const [queuedGift, setQueuedGift] = useState<any>(null)
  // 控制拦截弹窗 'none' | 'match' | 'bandaid' | 'milk'
  const [interceptModal, setInterceptModal] = useState<'none' | 'match' | 'bandaid' | 'milk'>('none')
  
  const router = useRouter()

  useEffect(() => {
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    const currentEntry = entries[0]
    
    const randStr = Math.random().toString(36).substring(2, 4).toUpperCase()
    const timestampStr = Date.now().toString().slice(-4)
    const newReceiptId = `EH-${randStr}${timestampStr}`
    setReceiptId(newReceiptId)

    if (currentEntry) {
      if (currentEntry.persona === 'Manager') {
        setIsManagerMode(true)
        setItem({ id: 'manager_letter', icon: '✉️', name: '一封未读的留言', desc: '它正安静地躺在吧台抽屉里，等待被店长拆开。' })
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

    // 进页面静默拉取盲盒（单次登录防刷：用 sessionStorage 阻断）
    if (!isManagerMode && !sessionStorage.getItem('gift_checked')) {
      let visitCount = 0
      try { visitCount = JSON.parse(localStorage.getItem('end_here_customer_profile') || '{}').visitCount || 0 } catch {}
      
      fetch(`/api/basket?visitCount=${visitCount}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.item) {
            setQueuedGift(data.item)
            sessionStorage.setItem('gift_checked', 'true') // 本次聊天不再触发任何新掉落
          }
        }).catch(() => {})
    }
  }, [isManagerMode])

  // 打票瞬间
  const handleSave = () => {
    track('save_entry', { scoreEnd, item_id: item?.id })
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    if (entries.length > 0) {
      entries[0].emotionEnd = scoreEnd
      entries[0].status = isManagerMode ? '未投递' : '已记录' 
      entries[0].item = item
      entries[0].receiptId = receiptId 
      localStorage.setItem('entries', JSON.stringify(entries))
    }
    setSaved(true)

    // 如果盲盒是牛奶或者店长券，纯温暖，直接弹！
    if (queuedGift && (queuedGift.giftId === 'milk' || queuedGift.giftId === 'manager_coupon')) {
      setInterceptModal('milk')
    }
  }

  // 点击：到此为止 -> 触发火柴拦截，否则去 /destroy
  const handleEndHere = () => {
    if (queuedGift && queuedGift.giftId === 'match') {
      setInterceptModal('match')
    } else {
      router.push('/destroy')
    }
  }

  // 点击：收进抽屉 -> 触发创可贴拦截，否则去 /archive
  const handleArchive = () => {
    if (queuedGift && queuedGift.giftId === 'bandaid') {
      setInterceptModal('bandaid')
    } else {
      router.push('/archive')
    }
  }

  // 拦截器：使用陌生人物品 (Patch Take -> 执行对应路线)
  const handleUseGift = async () => {
    if (!queuedGift) return
    if (!queuedGift.isManagerCoupon) {
      await fetch('/api/basket', { method: 'PATCH', body: JSON.stringify({ id: queuedGift.id, action: 'take' }) }).catch(()=>{})
    }
    
    if (queuedGift.giftId === 'match') {
      router.push('/destroy?strangerMatch=true')
    } else if (queuedGift.giftId === 'bandaid') {
      const entries = JSON.parse(localStorage.getItem('entries') || '[]')
      if (entries.length > 0) {
        entries[0].isSealed = true
        entries[0].sealedUntil = Date.now() + 12 * 60 * 60 * 1000 // 半日贴
        localStorage.setItem('entries', JSON.stringify(entries))
      }
      router.push('/archive')
    } else {
      setInterceptModal('none') // 牛奶/券，喝掉即可，模态框消失
    }
  }

  // 拦截器：放回筐里 (Patch Return -> 执行原定路线)
  const handleReturnGift = async () => {
    if (!queuedGift) return
    if (!queuedGift.isManagerCoupon) {
      await fetch('/api/basket', { method: 'PATCH', body: JSON.stringify({ id: queuedGift.id, action: 'return' }) }).catch(()=>{})
    }
    
    if (queuedGift.giftId === 'match') router.push('/destroy')
    else if (queuedGift.giftId === 'bandaid') router.push('/archive')
    else setInterceptModal('none') // 牛奶放回
  }

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', padding: '50px 20px', opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease', margin: '0 auto', position: 'relative' }}>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', padding: '36px 24px 40px', background: '#fbfaf7', color: '#2a2a2a', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative', fontFamily: 'monospace, "PingFang SC"', clipPath: 'polygon(0% 0%, 4% 2%, 8% 0%, 12% 2%, 16% 0%, 20% 2%, 24% 0%, 28% 2%, 32% 0%, 36% 2%, 40% 0%, 44% 2%, 48% 0%, 52% 2%, 56% 0%, 60% 2%, 64% 0%, 68% 2%, 72% 0%, 76% 2%, 80% 0%, 84% 2%, 88% 0%, 92% 2%, 96% 0%, 100% 2%, 100% 98%, 96% 100%, 92% 98%, 88% 100%, 84% 98%, 80% 100%, 76% 98%, 72% 100%, 68% 98%, 64% 100%, 60% 98%, 56% 100%, 52% 98%, 48% 100%, 44% 98%, 40% 100%, 36% 98%, 32% 100%, 28% 98%, 24% 100%, 20% 98%, 16% 100%, 12% 98%, 8% 100%, 4% 98%, 0% 100%)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: 0.7 }}>
          <p style={{ fontSize: '9px', letterSpacing: '3px', margin: 0 }}>*{receiptId}*</p>
        </div>
        <div style={{ width: '100%', height: '1px', borderTop: '1px dashed #8c8273', opacity: 0.3 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
          <p style={{ fontSize: '11px', color: '#8f857a', letterSpacing: '0.2em', margin: 0 }}>{isManagerMode ? 'COUNTER TICKET' : 'MEMORIES RECORD'}</p>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.05em', margin: '4px 0 0', color: '#1a1612' }}>{isManagerMode ? '凭条已生成' : '一切到此为止'}</h2>
        </div>
        {item && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '4px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', width: '100%', textAlign: 'left' }}>
            <div style={{ fontSize: '36px', lineHeight: 1 }}>{item.icon}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <p style={{ color: '#1a1612', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>【{item.name}】</p>
              <p style={{ color: '#6e655f', fontSize: '11px', lineHeight: '1.5', margin: 0 }}>{item.desc}</p>
            </div>
          </div>
        )}
        <div style={{ width: '100%', height: '1px', borderTop: '1px dashed #8c8273', opacity: 0.3 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', textAlign: 'left' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0, color: '#1a1612' }}>END HERE 避难所</p>
            <p style={{ fontSize: '9px', color: '#8f857a', marginTop: '2px', margin: 0 }}>{new Date().toLocaleDateString('zh-CN')} {new Date().toLocaleTimeString('zh-CN', {hour12:false}).slice(0,5)}</p>
          </div>
        </div>
      </div>

      {!saved && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>打出小票前，现在心情好点了吗？</p>
          <input type="range" min={1} max={10} value={scoreEnd} onChange={(e) => setScoreEnd(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--warm-yellow)', cursor: 'pointer' }} />
          <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.08)', color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 'bold' }}>
            嗞嗞 · 撕下小票
          </button>
        </div>
      )}

      {saved && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.8s ease' }}>
          {isManagerMode ? (
            <button onClick={() => router.push(`/counter?receiptId=${receiptId}&mode=manager`)} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px dashed var(--warm-yellow)', background: 'rgba(245,200,66,0.04)', color: 'var(--warm-yellow)', fontSize: '14px', letterSpacing: '0.1em', cursor: 'pointer' }}>
              📥 去吧台把小票压在玻璃杯下
            </button>
          ) : (
            <>
              <button onClick={handleEndHere} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(245,200,66,0.6)', background: 'rgba(245,200,66,0.08)', color: 'var(--warm-yellow)', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.15em', cursor: 'pointer' }}>
                到此为止 · End Here
              </button>
              <button onClick={handleArchive} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer' }}>
                暂时收进兜里
              </button>
            </>
          )}
        </div>
      )}

      {/* 命运的相遇：强行阻断式弹窗（无背包，当场抉择） */}
      {interceptModal !== 'none' && queuedGift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,16,14,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#1e1c18', border: '1px solid rgba(245,200,66,0.3)', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', animation: 'toastSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', letterSpacing: '0.2em', margin: 0 }}>
              {queuedGift.isManagerCoupon ? '【 奇迹掉落 】' : '【 铁筐里有陌生人留下的东西 】'}
            </p>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ fontSize: '42px' }}>{queuedGift.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 'bold' }}>{queuedGift.name}</span>
                {queuedGift.timeLabel && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{queuedGift.timeLabel} 某人留下</span>}
              </div>
            </div>

            <div style={{ padding: '14px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', borderLeft: '2px solid rgba(245,200,66,0.4)' }}>
              <p style={{ color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.7', fontStyle: 'italic', opacity: 0.9, margin: 0 }}>
                "{queuedGift.msg}"
              </p>
            </div>

            {queuedGift.isManagerCoupon && <p style={{ color: '#e87070', fontSize: '10px', letterSpacing: '0.1em', margin: 0 }}>*店长的纸条，你只能收下*</p>}
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={handleUseGift} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.5)', background: 'rgba(245,200,66,0.1)', color: 'var(--warm-yellow)', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.1em', cursor: 'pointer' }}>
                {interceptModal === 'match' ? '划亮它烧掉小票' : interceptModal === 'bandaid' ? '撕开封印伤口' : '收下，谢谢'}
              </button>
              
              {!queuedGift.isManagerCoupon && (
                <button onClick={handleReturnGift} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', opacity: 0.7 }}>
                  放回去
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  )
}