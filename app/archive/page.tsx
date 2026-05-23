'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '../lib/track'
import { recordCustomerAction } from '../lib/memory'

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
}

function getStatusColor(status: string) {
  if (status === '还在痛') return '#e87070'
  if (status === '好一点了') return 'var(--warm-yellow)'
  if (status === '快放下了') return '#a0c4a0'
  if (status === '等待回信') return 'var(--warm-yellow)'
  if (status === '未投递') return '#e87070' // 👈 增加警示红
  return 'var(--text-muted)'
}

function EntryCard({ entry, expanded, setExpanded, formatDate, router }: {
  entry: Entry
  expanded: number | null
  setExpanded: (id: number | null) => void
  formatDate: (iso: string) => string
  router: any
}) {
  const [managerReply, setManagerReply] = useState<string | null>(null)
  const [fetchingReply, setFetchingReply] = useState(false)
  const isManagerTicket = !!entry.receiptId || entry.persona === 'Manager' || entry.status === '等待回信' || entry.status === '未投递'

  useEffect(() => {
    // 👈 核心修复：只有状态真的是等待回信，才去后台查库，省得空查
    if (expanded === entry.id && isManagerTicket && entry.receiptId && !managerReply && entry.status === '等待回信') {
      setFetchingReply(true)
      fetch(`/api/mailbox?receiptId=${entry.receiptId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.reply) {
            setManagerReply(data.reply)
          }
        })
        .catch(err => console.error('获取回信失败:', err))
        .finally(() => setFetchingReply(false))
    }
  }, [expanded, entry.id, entry.receiptId, isManagerTicket, managerReply, entry.status])

  return (
    <div style={{
      borderRadius: '12px',
      border: `1px solid ${entry.released ? 'rgba(255,255,255,0.04)' : 'var(--border)'}`,
      background: entry.released ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
      opacity: entry.released ? 0.5 : 1,
      transition: 'opacity 0.3s ease',
    }}>

      <div
        onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
        style={{ padding: '16px 20px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {entry.item && (
              <span style={{ fontSize: '16px' }}>{entry.item.icon}</span>
            )}
            <span style={{
              padding: '2px 10px', borderRadius: '999px',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: '11px',
            }}>
              {EMOTION_LABELS[entry.emotion] || entry.emotion}
            </span>
            {entry.status && (
              <span style={{
                padding: '2px 10px', borderRadius: '999px',
                border: `1px solid ${getStatusColor(entry.status)}40`,
                color: getStatusColor(entry.status),
                fontSize: '11px',
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
          color: 'var(--text-main)', fontSize: '13px',
          lineHeight: '1.7', opacity: 0.8,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: expanded === entry.id ? 'unset' : 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {entry.content}
        </p>
      </div>

      {expanded === entry.id && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          
          {isManagerTicket && (
            <div style={{
              padding: '16px', borderRadius: '12px',
              background: 'rgba(245,200,66,0.04)',
              border: '1px dashed rgba(245,200,66,0.25)',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🏪</span>
                <span style={{ color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.1em', fontWeight: 'bold' }}>
                  吧台回信
                </span>
                {entry.receiptId && (
                  <span style={{ marginLeft: 'auto', color: 'var(--warm-yellow)', fontSize: '10px', fontFamily: 'monospace', opacity: 0.5 }}>
                    #{entry.receiptId}
                  </span>
                )}
              </div>
              
              {/* === 核心修复 4：针对未投递的死胡同给予明显反馈 === */}
              {entry.status === '未投递' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <p style={{ color: '#e87070', fontSize: '13px', fontWeight: 'bold' }}>⚠️ 留言未投递</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.8, lineHeight: '1.6' }}>
                    你当时只打印了小票，但没有把它压在吧台。店长收不到这封信。
                  </p>
                  <button
                    onClick={() => router.push(`/counter?receiptId=${entry.receiptId || ''}&mode=manager`)}
                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--warm-yellow)', background: 'rgba(245,200,66,0.05)', color: 'var(--warm-yellow)', fontSize: '12px', cursor: 'pointer', marginTop: '4px', letterSpacing: '0.1em' }}
                  >
                    重新去吧台投递
                  </button>
                </div>
              ) : !entry.receiptId ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>
                  这张小票好像没有印上流水号，店长找不到它了...
                </p>
              ) : fetchingReply ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>
                  正在吧台抽屉里翻找你的小票...
                </p>
              ) : managerReply ? (
                <p style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.8', opacity: 0.9 }}>
                  {managerReply}
                </p>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>
                  店长还在跑车，或者已经睡了。晚点再来看看吧。
                </p>
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
              color: 'var(--text-main)', fontSize: '15px',
              fontWeight: '500', lineHeight: '1.7',
              padding: '16px 0', borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}>
              {entry.punchline}
            </p>
          )}

          {!entry.released ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              {!isManagerTicket && (
                <button
                  onClick={() => {
                    recordCustomerAction('ruminate')
                    router.push(`/ruminate?id=${entry.id}`)
                  }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-muted)', fontSize: '12px',
                    letterSpacing: '0.15em', cursor: 'pointer',
                  }}
                >
                  继续处理这件事
                </button>
              )}
              <button
                onClick={() => {
                  recordCustomerAction('letGo')
                  const entries = JSON.parse(localStorage.getItem('entries') || '[]')
                  const idx = entries.findIndex((e: any) => e.id === entry.id)
                  if (idx !== -1) {
                    entries[idx].status = '到此为止'
                    entries[idx].released = true
                    entries[idx].releasedAt = new Date().toISOString()
                    localStorage.setItem('entries', JSON.stringify(entries))
                  }
                  router.push('/release')
                }}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '1px solid rgba(160,196,160,0.3)',
                  background: 'rgba(160,196,160,0.04)',
                  color: '#a0c4a0', fontSize: '12px',
                  letterSpacing: '0.15em', cursor: 'pointer',
                }}
              >
                我想彻底放下它
              </button>
            </div>
          ) : (
            <p style={{
              textAlign: 'center', color: 'var(--text-muted)',
              fontSize: '12px', opacity: 0.4, letterSpacing: '0.1em',
            }}>
              已放下
            </p>
          )}
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

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('entries') || '[]')
    const patchedEntries = saved.map((e: any, i: number) => {
      if (!e.id) {
        return { ...e, id: Date.now() + i }
      }
      return e
    })
    
    setEntries(patchedEntries)
    localStorage.setItem('entries', JSON.stringify(patchedEntries))
    track('view_archive', { entry_count: patchedEntries.length })
  }, [])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
    setFeedbackFeatures(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    )
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '360px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '60px 24px',
      margin: '0 auto'
    }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>END HERE</p>
        <h1 style={{ color: 'var(--text-main)', fontSize: '20px', fontWeight: '300', letterSpacing: '0.1em' }}>
          你的档案
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>
          {entries.length > 0 ? `共 ${entries.length} 条记录` : '还没有记录'}
        </p>
      </div>

      {entries.length === 0 ? (
        <div style={{
          padding: '40px 24px', borderRadius: '12px',
          border: '1px dashed var(--border)',
          background: 'rgba(255,255,255,0.01)', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.5, lineHeight: '2' }}>
            吧台的旧抽屉还是空的。<br />
            不想说也没事。<br />
            实在憋得难受了，再随便塞点什么进来。
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {entries.filter(e => !e.released).map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              expanded={expanded}
              setExpanded={setExpanded}
              formatDate={formatDate}
              router={router}
            />
          ))}

          {entries.some(e => e.released) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              margin: '8px 0',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              <p style={{
                color: 'var(--text-muted)', fontSize: '11px',
                opacity: 0.3, letterSpacing: '0.2em', whiteSpace: 'nowrap',
              }}>
                封存的记忆
              </p>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            </div>
          )}

          {entries.filter(e => e.released).map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              expanded={expanded}
              setExpanded={setExpanded}
              formatDate={formatDate}
              router={router}
            />
          ))}
        </div>
      )}

      {!feedbackSent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!showFeedback ? (
            <button
              onClick={() => setShowFeedback(true)}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-muted)', fontSize: '12px',
                letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.5,
              }}
            >
              你希望 End Here 还能做什么？
            </button>
          ) : (
            <div style={{
              padding: '20px', borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex', flexDirection: 'column', gap: '16px',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>
                你希望哪个功能先上？
              </p>

              {[
                { id: 'title', label: '称号系统', desc: '记录你走过的每一次' },
                { id: 'collect', label: '稀有收藏物件', desc: '更多有意义的物件' },
                { id: 'chart', label: '情绪趋势图', desc: '看自己的情绪变化' },
                { id: 'remind', label: '定期复查提醒', desc: '提醒你回来处理旧记录' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => toggleFeature(f.id)}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                    border: `1px solid ${feedbackFeatures.includes(f.id) ? 'rgba(245,200,66,0.4)' : 'var(--border)'}`,
                    background: feedbackFeatures.includes(f.id) ? 'rgba(245,200,66,0.06)' : 'transparent',
                    color: feedbackFeatures.includes(f.id) ? 'var(--warm-yellow)' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{f.label}</span>
                  <span style={{ fontSize: '11px', opacity: 0.6 }}>{f.desc}</span>
                </button>
              ))}

              <textarea
                value={feedbackCustom}
                onChange={(e) => setFeedbackCustom(e.target.value)}
                placeholder="或者，你有别的想法？"
                rows={3}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)', borderRadius: '10px',
                  padding: '12px 16px', color: 'var(--text-main)',
                  fontSize: '13px', lineHeight: '1.8', fontFamily: 'inherit',
                }}
              />

              <button
                onClick={handleFeedback}
                disabled={feedbackFeatures.length === 0 && !feedbackCustom.trim()}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '1px solid rgba(245,200,66,0.3)',
                  background: 'rgba(245,200,66,0.08)',
                  color: 'var(--warm-yellow)', fontSize: '13px',
                  letterSpacing: '0.15em', cursor: 'pointer',
                  opacity: feedbackFeatures.length > 0 || feedbackCustom.trim() ? 1 : 0.4,
                }}
              >
                提交
              </button>
            </div>
          )}
        </div>
      ) : (
        <p style={{
          textAlign: 'center', color: 'var(--text-muted)',
          fontSize: '12px', opacity: 0.5, letterSpacing: '0.1em',
        }}>
          ✓ 收到了，谢谢你。
        </p>
      )}

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
  )
}