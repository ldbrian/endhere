'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const EMOTION_LABELS: Record<string, string> = {
  regret: '后悔', grievance: '委屈', unwilling: '不甘', irritated: '烦躁', sad: '难过',
}

interface Entry {
  id: number
  emotion: string
  content: string
  persona: string
  response: string
  createdAt: string
}

export default function ArchivePage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('entries') || '[]')
    setEntries(saved)
  }, [])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>
          END HERE
        </p>
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
          padding: '40px 24px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', opacity: 0.5, lineHeight: '2' }}>
            这里会保存你写下的每一次
            <br />
            到此为止
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              {/* 顶部信息行 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: '999px',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                  }}>
                    {EMOTION_LABELS[entry.emotion] || entry.emotion}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>
                    {entry.persona}
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.4 }}>
                  {formatDate(entry.createdAt)}
                </span>
              </div>

              {/* 内容预览 */}
              <p style={{
                color: 'var(--text-main)',
                fontSize: '13px',
                lineHeight: '1.7',
                opacity: 0.8,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: expanded === entry.id ? 'unset' : 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {entry.content}
              </p>

              {/* 展开后显示AI回应 */}
              {expanded === entry.id && (
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  {entry.response.split('---').map((s, i) => (
                    <p key={i} style={{
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      lineHeight: '1.8',
                    }}>
                      {s.trim()}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 底部按钮 */}
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
          opacity: 0.7,
        }}
      >
        回到开始
      </button>

    </div>
  )
}