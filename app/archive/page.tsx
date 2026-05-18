'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '../lib/track'

const EMOTION_LABELS: Record<string, string> = {
  regret: '后悔', grievance: '委屈', unwilling: '不甘', irritated: '烦躁', sad: '难过',
}

interface Entry {
  id: number
  emotion: string
  content: string
  persona: string
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
}

function getStatusColor(status: string) {
  if (status === '还在痛') return '#e87070'
  if (status === '好一点了') return 'var(--warm-yellow)'
  if (status === '快放下了') return '#a0c4a0'
  return 'var(--text-muted)'
}

function EntryCard({ entry, expanded, setExpanded, formatDate, router }: {
  entry: Entry
  expanded: number | null
  setExpanded: (id: number | null) => void
  formatDate: (iso: string) => string
  router: any
}) {
  return (
    <div style={{
      borderRadius: '12px',
      border: `1px solid ${entry.released ? 'rgba(255,255,255,0.04)' : 'var(--border)'}`,
      background: entry.released ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
      opacity: entry.released ? 0.5 : 1,
      transition: 'opacity 0.3s ease',
    }}>

      {/* 记录头部 */}
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

        {entry.emotionEnd && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>
              {entry.emotionStart} → {entry.emotionEnd}
            </span>
            {entry.sessions && entry.sessions.length > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.4 }}>
                · 已复查 {entry.sessions.length} 次
              </span>
            )}
          </div>
        )}
      </div>

      {/* 展开内容 */}
      {expanded === entry.id && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {/* 解析 */}
          {entry.analysis && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8', opacity: 0.8 }}>
              {entry.analysis}
            </p>
          )}

          {/* 主旨 */}
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

          {/* 历史复查 */}
          {entry.sessions && entry.sessions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em' }}>
                复查记录
              </p>
              {entry.sessions.map((s: any, i: number) => (
                <div key={i} style={{
                  padding: '12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5, marginBottom: '6px' }}>
                    {formatDate(s.createdAt)} · {s.persona} · {s.scoreEnd}分
                  </p>
                  {s.supplement && (
                    <p style={{ color: 'var(--text-main)', fontSize: '12px', lineHeight: '1.7', opacity: 0.7, marginBottom: '8px' }}>
                      {s.supplement}
                    </p>
                  )}
                  {s.response && s.response.split('---').map((r: string, j: number) => (
                    <p key={j} style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.7 }}>
                      {r.trim()}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          {!entry.released ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => router.push(`/ruminate?id=${entry.id}`)}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: '12px',
                  letterSpacing: '0.15em', cursor: 'pointer',
                }}
              >
                继续处理这件事
              </button>
              <button
                onClick={() => {
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
    setEntries(saved)
    track('view_archive', { entry_count: saved.length })
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
    }}>

      {/* 顶部 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>END HERE</p>
        <h1 style={{ color: 'var(--text-main)', fontSize: '20px', fontWeight: '300', letterSpacing: '0.1em' }}>
          你的档案
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>
          {entries.length > 0 ? `共 ${entries.length} 条记录` : '还没有记录'}
        </p>
      </div>

      {/* 档案列表 */}
      {entries.length === 0 ? (
        <div style={{
          padding: '40px 24px', borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', opacity: 0.5, lineHeight: '2' }}>
            这里会保存你写下的每一次<br />到此为止
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 活跃区 */}
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

          {/* 分割线 */}
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

          {/* 归档区 */}
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

      {/* 反馈区块 */}
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

              {/* 功能选项 */}
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

              {/* 自定义输入 */}
              <textarea
                value={feedbackCustom}
                onChange={(e) => setFeedbackCustom(e.target.value)}
                placeholder="或者，你有别的想法？"
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  fontFamily: 'inherit',
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