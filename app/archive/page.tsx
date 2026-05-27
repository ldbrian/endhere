'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '../lib/track'
import { recordCustomerAction } from '../lib/memory'
import { useBasketClaim } from '../hooks/useBasketClaim'

const EMOTION_LABELS: Record<string, string> = {
  choke: '胸口堵得慌', 
  tear: '眼眶有点热', 
  numb: '整个人木木的', 
  angry: '心里有股无名火', 
  shattered: '快碎掉了',
}

interface Entry {
  id: number
  emotion: string
  content: string
  persona?: string
  response: string
  analysis?: string
  punchline?: string
  createdAt: string
  emotionStart: number
  emotionEnd: number
  status: string
  released: boolean
  item?: { icon: string; name: string }
  sessions?: any[]
  receiptId?: string 
  isSealed?: boolean
  sealedUntil?: number
}

function getStatusColor(status: string) {
  if (status === '还在痛') return '#e87070'
  if (status === '好一点了') return 'var(--warm-yellow)'
  if (status === '快放下了') return '#a0c4a0'
  if (status === '等待回信') return 'var(--warm-yellow)'
  if (status === '未投递') return '#e87070' 
  if (status === '彻底销毁') return '#444' 
  return 'var(--text-muted)'
}

function EntryCard({ entry, expanded, setExpanded, formatDate, router, onApplyBandaid, onEndHere }: {
  entry: Entry
  expanded: number | null
  setExpanded: (id: number | null) => void
  formatDate: (iso: string) => string
  router: any
  onApplyBandaid: (id: number, hours: number) => void
  onEndHere: (id: number) => void
}) {
  const [managerReply, setManagerReply] = useState<string | null>(null)
  const [fetchingReply, setFetchingReply] = useState(false)
  const isManagerTicket = entry.persona === 'Manager' || entry.status === '等待回信' || entry.status === '未投递'

  const isDestroyed = entry.status === '彻底销毁'
  const isCurrentlySealed = entry.isSealed && entry.sealedUntil && Date.now() < entry.sealedUntil
  
  const timeLeftMs = isCurrentlySealed ? (entry.sealedUntil! - Date.now()) : 0
  const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60))
  const minsLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60))
  const timeDisplay = hoursLeft > 0 ? `${hoursLeft} 小时 ${minsLeft} 分` : `${minsLeft} 分钟`

  useEffect(() => {
    if (expanded === entry.id && isManagerTicket && entry.receiptId && !managerReply && entry.status === '等待回信') {
      setFetchingReply(true)
      fetch(`/api/mailbox?receiptId=${entry.receiptId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.reply) setManagerReply(data.reply)
        })
        .finally(() => setFetchingReply(false))
    }
  }, [expanded, entry.id, entry.receiptId, isManagerTicket, managerReply, entry.status])

  if (isDestroyed) {
    return (
      <div style={{
        padding: '16px 20px', borderRadius: '4px',
        border: '1px dashed rgba(255,255,255,0.05)',
        background: 'rgba(0,0,0,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: '#555', fontSize: '11px', fontFamily: 'monospace' }}>
            ID: {entry.receiptId || entry.id}
          </span>
          <span style={{ color: '#444', fontSize: '12px', letterSpacing: '0.1em' }}>
            [ 已物理焚毁 ]
          </span>
        </div>
        <span style={{ fontSize: '20px', opacity: 0.2 }}>💨</span>
      </div>
    )
  }

  return (
    <div style={{
      borderRadius: '12px',
      border: `1px solid ${entry.released ? 'rgba(255,255,255,0.04)' : 'var(--border)'}`,
      background: entry.released ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
      opacity: entry.released ? 0.5 : 1,
      transition: 'opacity 0.3s ease',
      position: 'relative'
    }}>

      {isCurrentlySealed && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backdropFilter: 'blur(5px)', background: 'rgba(26,22,18,0.7)',
          zIndex: 10, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', gap: '8px'
        }}>
          <span style={{ fontSize: '24px', transform: 'rotate(-10deg)' }}>🩹</span>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.15em', fontWeight: '500' }}>伤口结痂中，请勿触碰</p>
          <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', fontFamily: 'monospace', opacity: 0.8 }}>自然解封: {timeDisplay}</p>
        </div>
      )}

      <div
        onClick={() => { if (!isCurrentlySealed) setExpanded(expanded === entry.id ? null : entry.id) }}
        style={{ padding: '16px 20px', cursor: isCurrentlySealed ? 'not-allowed' : 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {entry.item && <span style={{ fontSize: '16px' }}>{entry.item.icon}</span>}
            <span style={{
              padding: '2px 10px', borderRadius: '999px',
              border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px',
            }}>
              {EMOTION_LABELS[entry.emotion] || entry.emotion || '未知情绪'}
            </span>
            {entry.status && (
              <span style={{
                padding: '2px 10px', borderRadius: '999px',
                border: `1px solid ${getStatusColor(entry.status)}40`,
                color: getStatusColor(entry.status), fontSize: '11px',
              }}>
                {entry.status}
              </span>
            )}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.4 }}>
            {formatDate(entry.createdAt)}
          </span>
        </div>

        <p style={{
          color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.7', opacity: 0.8,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: expanded === entry.id ? 'unset' : 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {entry.content}
        </p>
      </div>

      {expanded === entry.id && !isCurrentlySealed && (
        <div style={{
          borderTop: '1px solid var(--border)', padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          
          {isManagerTicket && (
            <div style={{
              padding: '16px', borderRadius: '12px', background: 'rgba(245,200,66,0.04)',
              border: '1px dashed rgba(245,200,66,0.25)', display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🏪</span>
                <span style={{ color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.1em', fontWeight: 'bold' }}>吧台回信</span>
                {entry.receiptId && <span style={{ marginLeft: 'auto', color: 'var(--warm-yellow)', fontSize: '10px', fontFamily: 'monospace', opacity: 0.5 }}>#{entry.receiptId}</span>}
              </div>
              
              {entry.status === '未投递' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <p style={{ color: '#e87070', fontSize: '13px', fontWeight: 'bold' }}>⚠️ 留言未投递</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.8, lineHeight: '1.6' }}>你当时只打印了小票，但没有把它压在吧台。店长收不到这封信。</p>
                  <button onClick={() => router.push(`/counter?receiptId=${entry.receiptId || ''}&mode=manager`)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--warm-yellow)', background: 'rgba(245,200,66,0.05)', color: 'var(--warm-yellow)', fontSize: '12px', cursor: 'pointer', marginTop: '4px', letterSpacing: '0.1em' }}>重新去吧台投递</button>
                </div>
              ) : !entry.receiptId ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>这张小票好像没有印上流水号，店长找不到它了...</p>
              ) : fetchingReply ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>正在吧台抽屉里翻找你的小票...</p>
              ) : managerReply ? (
                <p style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.8', opacity: 0.9 }}>{managerReply}</p>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>店长还在跑车，暂无回信。</p>
              )}
            </div>
          )}

          {!isManagerTicket && entry.analysis && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8', opacity: 0.8 }}>
              {entry.analysis}
            </p>
          )}

          {entry.punchline && (
            <p style={{
              color: 'var(--text-main)', fontSize: '15px', fontWeight: '500', lineHeight: '1.7',
              padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
            }}>
              {entry.punchline}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            {!isManagerTicket ? (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onEndHere(entry.id)}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '10px', 
                      border: '1px solid rgba(245,200,66,0.6)', 
                      background: 'rgba(245,200,66,0.08)', 
                      color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.1em', 
                      cursor: 'pointer', fontWeight: 'bold',
                      boxShadow: '0 0 12px rgba(245,200,66,0.1)',
                      textShadow: '0 0 8px rgba(245,200,66,0.3)'
                    }}
                  >
                    到此为止
                  </button>
                  
                  <button
                    onClick={() => { recordCustomerAction('ruminate'); router.push(`/ruminate?id=${entry.id}`); }}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '10px', border: '1px dashed var(--border)', 
                      background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.1em', cursor: 'pointer',
                    }}
                  >
                    继续谈论
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { label: '半日贴', hours: 12 },
                    { label: '一日贴', hours: 24 },
                    { label: '三日贴', hours: 72 }
                  ].map(b => (
                    <button
                      key={b.hours}
                      onClick={() => onApplyBandaid(entry.id, b.hours)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: '8px', border: '1px dashed #d4956a',
                        background: 'rgba(212,149,106,0.05)', color: '#d4956a', fontSize: '11px', cursor: 'pointer', opacity: 0.9, transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(212,149,106,0.1)'}}
                      onMouseLeave={e => {e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.background = 'rgba(212,149,106,0.05)'}}
                    >
                      🩹 {b.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                onClick={() => onEndHere(entry.id)}
                style={{
                  width: '100%', padding: '14px', borderRadius: '10px',
                  border: '1px solid rgba(245,200,66,0.6)', 
                  background: 'rgba(245,200,66,0.08)', 
                  color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.15em', 
                  cursor: 'pointer', fontWeight: 'bold',
                  boxShadow: '0 0 12px rgba(245,200,66,0.1)',
                  textShadow: '0 0 8px rgba(245,200,66,0.3)'
                }}
              >
                到此为止 · End Here
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ArchivePage() {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackFeatures, setFeedbackFeatures] = useState<string[]>([])
  const [feedbackCustom, setFeedbackCustom] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)  
  const [entries, setEntries] = useState<Entry[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const router = useRouter()

  // === 引入命中拦截器 ===
  const { checkBasket, takeGift, returnGift } = useBasketClaim()
  const [queuedGift, setQueuedGift] = useState<any>(null)
  // 统一的待处理动作状态
  const [pendingAction, setPendingAction] = useState<{ type: 'bandaid' | 'match', id: number, hours?: number } | null>(null)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('entries') || '[]')
    const patchedEntries = saved.map((e: any, i: number) => {
      if (!e.id) return { ...e, id: Date.now() + i }
      return e
    })
    
    setEntries(patchedEntries)
    localStorage.setItem('entries', JSON.stringify(patchedEntries))
    track('view_archive', { entry_count: patchedEntries.length })
  }, [])

  const formatDate = (iso: string) => {
    if (!iso) return '很久以前'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '很久以前'
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // --- 真实执行逻辑 ---
  const performApplyBandaid = (id: number, hours: number) => {
    track('apply_bandaid', { entry_id: id, hours })
    const updatedEntries = entries.map(e => {
      if (e.id === id) {
        return { ...e, isSealed: true, sealedUntil: Date.now() + hours * 60 * 60 * 1000 }
      }
      return e
    })
    setEntries(updatedEntries)
    localStorage.setItem('entries', JSON.stringify(updatedEntries))
  }

  const performEndHere = (id: number, strangerMatch = false) => {
    recordCustomerAction('letGo')
    const currentEntries = JSON.parse(localStorage.getItem('entries') || '[]')
    const idx = currentEntries.findIndex((e: any) => e.id === id)
    if (idx !== -1) {
      // 核心修复：只负责拔高到数组第一位，绝对不提前修改 released 和 status！
      const [item] = currentEntries.splice(idx, 1)
      currentEntries.unshift(item)
      localStorage.setItem('entries', JSON.stringify(currentEntries))
    }
    // 让销毁页决定它的最终命运
    router.push(strangerMatch ? '/destroy?strangerMatch=true' : '/destroy')
  }

  // --- 拦截层 ---
  const initiateApplyBandaid = async (id: number, hours: number) => {
    const gift = await checkBasket('bandaid')
    if (gift) {
      setQueuedGift(gift)
      setPendingAction({ type: 'bandaid', id, hours })
    } else {
      performApplyBandaid(id, hours)
    }
  }

  const initiateEndHere = async (id: number) => {
    const gift = await checkBasket('match')
    if (gift) {
      setQueuedGift(gift)
      setPendingAction({ type: 'match', id })
    } else {
      performEndHere(id, false)
    }
  }

  // --- 弹窗操作反馈 ---
  const handleTakeGift = async () => {
    if (!queuedGift || !pendingAction) return
    await takeGift(queuedGift.id)
    if (pendingAction.type === 'bandaid' && pendingAction.hours) {
      performApplyBandaid(pendingAction.id, pendingAction.hours)
    } else if (pendingAction.type === 'match') {
      performEndHere(pendingAction.id, true) // 收下火柴，带着烈火去销毁页
    }
    setQueuedGift(null)
    setPendingAction(null)
  }

  const handleReturnGift = async () => {
    if (!queuedGift || !pendingAction) return
    await returnGift(queuedGift.id)
    
    // 叙事逻辑修复：
    // 1. 如果是创可贴，放回去代表“我拒绝了你的好意”。直接取消动作，不执行封印。
    //    （如果用户真的想封，他可以再点一次按钮，此时会走系统免费封印逻辑）
    // 2. 如果是火柴，放回去代表“我不用火烧，我用普通的销毁机”。继续去销毁页。
    if (pendingAction.type === 'match') {
      performEndHere(pendingAction.id, false) 
    }
    
    setQueuedGift(null)
    setPendingAction(null)
  }

  const handleFeedback = async () => {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: feedbackFeatures, custom: feedbackCustom }),
    })
    setFeedbackSent(true)
  }

  const toggleFeature = (f: string) => {
    setFeedbackFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '60px 24px', margin: '0 auto' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>END HERE</p>
        <h1 style={{ color: 'var(--text-main)', fontSize: '20px', fontWeight: '300', letterSpacing: '0.1em' }}>
          我的抽屉
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>
          {entries.length > 0 ? `里面躺着 ${entries.length} 张旧单据` : '空空如也'}
        </p>
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: '40px 24px', borderRadius: '12px', border: '1px dashed var(--border)', background: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.5, lineHeight: '2' }}>
            吧台的旧抽屉还是空的。<br />
            不想说也没事。<br />
            实在憋得难受了，再随便塞点什么进来。
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {entries.filter(e => e.status !== '彻底销毁').map((entry) => (
            <EntryCard key={entry.id} entry={entry} expanded={expanded} setExpanded={setExpanded} formatDate={formatDate} router={router} onApplyBandaid={initiateApplyBandaid} onEndHere={initiateEndHere} />
          ))}
          
          {/* 这里去掉了以前旧的 "已放下" 渲染逻辑 */}
        </div>
      )}

      {/* 统一的命运拦截 UI */}
      {queuedGift && pendingAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,16,14,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#1e1c18', border: '1px solid rgba(245,200,66,0.3)', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', animation: 'toastSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', letterSpacing: '0.2em', margin: 0 }}>
              【 铁筐里有陌生人留下的{pendingAction.type === 'bandaid' ? '创可贴' : '火柴'} 】
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
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={handleTakeGift} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.5)', background: 'rgba(245,200,66,0.1)', color: 'var(--warm-yellow)', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.1em', cursor: 'pointer' }}>
                收下，{pendingAction.type === 'bandaid' ? '撕开封印伤口' : '划亮它烧掉小票'}
              </button>
              
              <button onClick={handleReturnGift} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', opacity: 0.7 }}>
                放回去
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 反馈表单 (省略...保持原有) */}
      {!feedbackSent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!showFeedback ? (
            <button onClick={() => setShowFeedback(true)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.5 }}>
              你希望 End Here 还能做什么？
            </button>
          ) : (
            <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>你希望哪个功能先上？</p>
              {[
                { id: 'title', label: '称号系统', desc: '记录你走过的每一次' },
                { id: 'collect', label: '稀有收藏物件', desc: '更多有意义的物件' },
                { id: 'chart', label: '情绪趋势图', desc: '看自己的情绪变化' },
                { id: 'remind', label: '定期复查提醒', desc: '提醒你回来处理旧记录' },
              ].map(f => (
                <button key={f.id} onClick={() => toggleFeature(f.id)} style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${feedbackFeatures.includes(f.id) ? 'rgba(245,200,66,0.4)' : 'var(--border)'}`, background: feedbackFeatures.includes(f.id) ? 'rgba(245,200,66,0.06)' : 'transparent', color: feedbackFeatures.includes(f.id) ? 'var(--warm-yellow)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                  <span style={{ fontSize: '13px' }}>{f.label}</span>
                  <span style={{ fontSize: '11px', opacity: 0.6 }}>{f.desc}</span>
                </button>
              ))}
              <textarea value={feedbackCustom} onChange={(e) => setFeedbackCustom(e.target.value)} placeholder="或者，你有别的想法？" rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.8', fontFamily: 'inherit' }} />
              <button onClick={handleFeedback} disabled={feedbackFeatures.length === 0 && !feedbackCustom.trim()} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.08)', color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer', opacity: feedbackFeatures.length > 0 || feedbackCustom.trim() ? 1 : 0.4 }}>
                提交
              </button>
            </div>
          )}
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', opacity: 0.5, letterSpacing: '0.1em' }}>
          ✓ 收到了，谢谢你。
        </p>
      )}

      <button
        onClick={() => router.push('/')}
        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(245,200,66,0.2)', background: 'transparent', color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.7 }}
      >
        回到开始
      </button>
      
      <style>{`
        @keyframes toastSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  )
}