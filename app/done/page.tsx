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

function getStatusByScore(score: number) {
  if (score >= 8) return { label: '还在痛', color: '#e87070' }
  if (score >= 5) return { label: '好一点了', color: 'var(--warm-yellow)' }
  if (score >= 3) return { label: '快放下了', color: '#a0c4a0' }
  return { label: '到此为止', color: 'var(--text-muted)' }
}

export default function DonePage() {
  const [item, setItem] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [scoreEnd, setScoreEnd] = useState(5)
  const [saved, setSaved] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  
  const [receiptId, setReceiptId] = useState('')
  const [inputCode, setInputCode] = useState('')
  
  const [mailboxStatus, setMailboxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [mailboxMsg, setMailboxMsg] = useState('')
  
  // === 新增：判断是否是“直达店长”的专属通道 ===
  const [isManagerMode, setIsManagerMode] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    const currentEntry = entries[0]
    
    // 生成流水号
    const randStr = Math.random().toString(36).substring(2, 4).toUpperCase()
    const timestampStr = Date.now().toString().slice(-4)
    const newReceiptId = `EH-${randStr}${timestampStr}`
    setReceiptId(newReceiptId)

    if (currentEntry) {
      // 如果是店长模式
      if (currentEntry.persona === 'Manager') {
        setIsManagerMode(true)
        setItem({ 
          id: 'manager_letter', 
          icon: '✉️', 
          name: '一封未读的留言', 
          desc: '它正安静地躺在吧台抽屉里，等待被店长拆开。' 
        })
      } else {
        // AI 模式走正常物品分配逻辑
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
      // 店长模式强行锁定状态为“等待回信”
      entries[0].status = isManagerMode ? '等待回信' : getStatusByScore(scoreEnd).label
      entries[0].item = item
    }
    localStorage.setItem('entries', JSON.stringify(entries))
    setSaved(true)
  }

  const handleLeaveForManager = async () => {
    if (mailboxStatus === 'loading' || mailboxStatus === 'success') return
    setMailboxStatus('loading')
    
    try {
      const entries = JSON.parse(localStorage.getItem('entries') || '[]')
      const userContent = entries[0]?.content || entries[0]?.text || '无言的投递...'
      const aiContent = entries[0]?.rawResponse || '【系统提示】：你选择了直接留言给店长。'

      const res = await fetch('/api/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, userMessage: userContent, aiResponse: aiContent })
      })
      const data = await res.json()
      
      if (data.success) {
        setMailboxStatus('success')
        setMailboxMsg(data.message)
        // 把流水号存进档案，方便以后查收回信
        entries[0].receiptId = receiptId
        localStorage.setItem('entries', JSON.stringify(entries))
      } else {
        setMailboxStatus('error')
        setMailboxMsg(data.message)
      }
    } catch (e) {
      setMailboxStatus('error')
      setMailboxMsg('吧台抽屉卡住了，请稍后再试。')
    }
  }

  // 分享功能 (保持原样)
  const handleShare = async () => {
    // ... 代码略 ... (如果这部分报错，用你原来的分享函数替换即可)
    track('share_card')
    if (isSharing) return
    setIsSharing(true)
    try {
      const element = document.getElementById('share-receipt')
      if (!element) return
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, logging: false } as any)
      const imgData = canvas.toDataURL('image/png')
      const downloadImage = (dataUrl: string) => {
        const link = document.createElement('a')
        link.download = `EndHere-${new Date().getTime()}.png`
        link.href = dataUrl
        link.click()
      }
      if (navigator.share) {
        try {
          const blob = await (await fetch(imgData)).blob()
          const file = new File([blob], 'end-here-receipt.png', { type: 'image/png' })
          await navigator.share({ title: '我的情绪小票', text: '一切到此为止。', files: [file] })
        } catch (err) { downloadImage(imgData) }
      } else { downloadImage(imgData) }
    } catch (error) { alert('生成卡片失败，请稍后再试。') } finally { setIsSharing(false) }
  }

  const handleActivateCode = () => {
    const cleanCode = inputCode.trim().toUpperCase()
    if (!cleanCode) return
    if (cleanCode === receiptId) {
      localStorage.setItem('extra_limit_granted', '3') 
      alert('📻 破收音机换上了新电池。今晚的卷帘门会晚一点落下。')
      setInputCode('')
    } else if (cleanCode === 'FOREVER2026') {
      localStorage.setItem('is_lifetime_vip', 'true')
      alert('🔑 你拿到了一把不会生锈的备用钥匙。这里永远为你留一盏灯。')
      setInputCode('')
    } else {
      alert('❓ 暗号对不上。')
    }
  }

  const status = getStatusByScore(scoreEnd)

  return (
    <div style={{
      width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '32px', padding: '40px 24px', textAlign: 'center',
      opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease', margin: '0 auto',
    }}>

      {/* --- 小票区域 --- */}
      <div id="share-receipt" style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '32px', padding: '32px 24px', background: '#121212', 
        borderRadius: '16px', border: saved ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}>
        <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.3em' }}>
            {isManagerMode ? '专属通道' : '已记录'}
          </p>
          <h2 style={{ color: 'var(--text-main)', fontSize: '26px', fontWeight: '300', letterSpacing: '0.15em', lineHeight: '1.8' }}>
            {isManagerMode ? '等待回音。' : '到此为止。'}
          </h2>
        </div>

        {item && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            padding: '28px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', 
            border: `1px dashed ${isManagerMode ? 'var(--warm-yellow)' : 'var(--border)'}`, 
            width: '100%', opacity: visible ? 1 : 0,
          }}>
            <div style={{ fontSize: '48px', lineHeight: 1 }}>{item.icon}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.15em' }}>
                {isManagerMode ? '' : '获得「'}{item.name}{isManagerMode ? '' : '」'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.8', opacity: 0.8 }}>{item.desc}</p>
            </div>
          </div>
        )}

        {saved && (
          <div style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px dashed rgba(255,255,255,0.1)', width: '88%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em' }}>End Here</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '4px', opacity: 0.5, letterSpacing: '0.05em' }}>深夜情绪便利店</p>
              <p style={{ color: 'var(--warm-yellow)', fontFamily: 'monospace', fontSize: '10px', marginTop: '8px', opacity: 0.8, letterSpacing: '0.05em' }}>
                流水号: #{receiptId}
              </p>
            </div>
            {!isManagerMode && (
              <div style={{ width: '44px', height: '44px', background: '#fff', padding: '2px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/qrcode.png" alt="二维码" style={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
              </div>
            )}
          </div>
        )}
      </div>

      {!saved && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>写完之后，现在感觉怎么样？</p>
          <input type="range" min={1} max={10} value={scoreEnd} onChange={(e) => setScoreEnd(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--warm-yellow)', cursor: 'pointer' }} />
          <button onClick={handleSave} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.08)', color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.2em', cursor: 'pointer' }}>
            确认打包小票
          </button>
        </div>
      )}

      {saved && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* === 核心操作：店长模式和普通模式的按钮区分 === */}
          <button
            onClick={handleLeaveForManager}
            disabled={mailboxStatus !== 'idle'}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', 
              border: mailboxStatus === 'success' ? '1px dashed #a0c4a0' : '1px dashed var(--warm-yellow)', 
              background: mailboxStatus === 'success' ? 'rgba(160,196,160,0.05)' : 'rgba(245,200,66,0.05)',
              color: mailboxStatus === 'success' ? '#a0c4a0' : (mailboxStatus === 'error' ? '#e87070' : 'var(--warm-yellow)'), 
              fontSize: '13px', letterSpacing: '0.1em', cursor: mailboxStatus === 'success' ? 'default' : 'pointer',
              fontWeight: isManagerMode ? 'bold' : 'normal',
            }}
          >
            {mailboxStatus === 'idle' && (isManagerMode ? '📥 确认将小票滑进吧台 (提交给店长)' : '📝 觉得不够？把这张票压在吧台')}
            {mailboxStatus === 'loading' && '正在把小票压入吧台抽屉...'}
            {mailboxStatus === 'success' && '✅ ' + mailboxMsg}
            {mailboxStatus === 'error' && '❌ ' + mailboxMsg}
          </button>

          {/* 收银台透明货架 (保持原样不动) */}
          <div style={{ width: '100%', padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(245,200,66,0.15)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '8px' }}>
             {/* ... 这里是你原本的打赏和对暗号代码，保持原样 ... */}
             <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.6', opacity: 0.7 }}>
              支持店长把这家破店开下去。转账时备注小票底部的暗号：<span style={{ color: 'var(--warm-yellow)' }}>#{receiptId}</span>。
            </p>
          </div>

          {/* AI 模式才显示分享，店长模式直接隐藏 */}
          {!isManagerMode && (
            <button onClick={handleShare} disabled={isSharing} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(245,200,66,0.6)', background: 'var(--warm-yellow)', color: '#1a1a1a', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.15em', cursor: 'pointer' }}>
              {isSharing ? '生成中...' : '保存 / 分享小票'}
            </button>
          )}

          <button onClick={() => router.push('/archive')} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer' }}>
            查看我的档案
          </button>
        </div>
      )}
    </div>
  )
}