'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PERSONAS, PERSONA_PLACEHOLDERS, PERSONA_BUTTONS } from '../lib/personas'
import { track } from '../lib/track'

const EMOTION_LABELS: Record<string, string> = {
  regret: '后悔', grievance: '委屈', unwilling: '不甘', irritated: '烦躁', sad: '难过',
}

function WriteContent() {
  const [content, setContent] = useState('')
  const [persona, setPersona] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const emotion = searchParams.get('emotion') || 'sad'
  const emotionLabel = EMOTION_LABELS[emotion] || '难过'

  const selectedPersona = PERSONAS.find(p => p.id === persona)

  const handleSubmit = () => {
    if (!content.trim() || !persona || loading) return
    setLoading(true)
    track('submit_entry', { persona, emotion, content_length: content.length })
    sessionStorage.setItem('entry_content', content)
    sessionStorage.setItem('entry_emotion', emotion)
    localStorage.setItem('preferred_persona', persona)
    router.push('/response')
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '360px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      padding: '60px 24px',
      transition: 'all 0.4s ease',
    }}>

      {/* 顶部提示 */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '8px',
        opacity: focused ? 0.3 : 1,
        transition: 'opacity 0.4s ease',
      }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>
          END HERE
        </p>
        <p style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: '300', letterSpacing: '0.1em', lineHeight: '1.8' }}>
          你感到<span style={{ color: 'var(--warm-yellow)' }}>「{emotionLabel}」</span>
        </p>
      </div>

      {/* 第一步：选角色 */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '12px',
        opacity: focused ? 0.2 : 1,
        transition: 'opacity 0.4s ease',
      }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.15em' }}>
          你想跟谁说？
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {PERSONAS.map(p => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              style={{
                flex: 1, padding: '12px 8px', borderRadius: '10px',
                border: `1px solid ${persona === p.id ? p.color : 'var(--border)'}`,
                background: persona === p.id ? `${p.color}15` : 'transparent',
                color: persona === p.id ? p.color : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.25s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: '500' }}>{p.label}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 第二步：输入框 */}
      {persona && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={PERSONA_PLACEHOLDERS[persona]}
              autoFocus
              rows={9}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                width: '100%',
                background: focused ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${focused ? (selectedPersona?.color + '40') : 'var(--border)'}`,
                borderRadius: '12px',
                padding: '20px',
                color: 'var(--text-main)',
                fontSize: '15px',
                lineHeight: '1.9',
                letterSpacing: '0.03em',
                fontFamily: 'inherit',
                transition: 'all 0.3s ease',
              }}
            />
            <p style={{
              position: 'absolute', bottom: '12px', right: '16px',
              color: 'var(--text-muted)', fontSize: '11px', opacity: 0.4,
            }}>
              {content.length}
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            style={{
              width: '100%', padding: '15px', borderRadius: '12px',
              border: `1px solid ${content.trim() ? (selectedPersona?.color + '50') : 'var(--border)'}`,
              background: content.trim() ? `${selectedPersona?.color}10` : 'transparent',
              color: content.trim() ? selectedPersona?.color : 'var(--text-muted)',
              fontSize: '14px', letterSpacing: '0.2em',
              cursor: content.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              opacity: content.trim() ? 1 : 0.4,
            }}
          >
            {loading ? '正在传递...' : PERSONA_BUTTONS[persona]}
          </button>
        </div>
      )}

      {!focused && (
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: '12px',
            cursor: 'pointer', opacity: 0.5, letterSpacing: '0.1em',
          }}
        >
          ← 返回
        </button>
      )}
    </div>
  )
}

export default function WritePage() {
  return (
    <Suspense>
      <WriteContent />
    </Suspense>
  )
}