'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PERSONAS, getRandomAction, PERSONA_BUTTONS } from '../lib/personas'
import { track, checkLimit } from '../lib/track'

const EMOTION_LABELS: Record<string, string> = {
  regret: '后悔', grievance: '委屈', unwilling: '不甘', irritated: '烦躁', sad: '难过',
}

interface Action {
  id: string
  text: string
  sub: string
}

function parseResponse(raw: string): { analysis: string; punchline: string } {
  const analysisMatch = raw.match(/<解析>([\s\S]*?)<\/解析>/)
  const punchlineMatch = raw.match(/<主旨>([\s\S]*?)<\/主旨>/)
  return {
    analysis: analysisMatch ? analysisMatch[1].trim() : '',
    punchline: punchlineMatch ? punchlineMatch[1].trim() : '',
  }
}

export default function ResponsePage() {
  const [persona, setPersona] = useState('Rin')
  const [content, setContent] = useState('')
  const [emotion, setEmotion] = useState('sad')
  const [rawResponse, setRawResponse] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [punchline, setPunchline] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const [actionDone, setActionDone] = useState(false)
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const savedContent = sessionStorage.getItem('entry_content') || ''
    const savedEmotion = sessionStorage.getItem('entry_emotion') || 'sad'
    const savedPersona = localStorage.getItem('preferred_persona') || 'Rin'
    setContent(savedContent)
    setEmotion(savedEmotion)
    setPersona(savedPersona)
  }, [])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [analysis, punchline, action])

  const stopLoadingText = () => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    setLoadingText('')
  }

  const handleStart = async () => {
    if (!content || loading) return
    // 限流检查
    const limit = await checkLimit()
    if (!limit.allowed) {
      setAnalysis(`今天已经用了 ${limit.limit} 次了。明天再来，或者先去做那件一直拖着的事。`)
      setStarted(true)
      setDone(true)
      return
    }
    setStarted(true)
    setLoading(true)
    setRawResponse('')
    setAnalysis('')
    setPunchline('')
    setAction(null)
    setDone(false)
    setActionDone(false)

    // 随机动作文案
    let actionIdx = 0
    const getNextAction = () => getRandomAction(persona)
    setLoadingText(getNextAction())
    const timer = setInterval(() => {
      setLoadingText(getNextAction())
    }, 1500)

    await new Promise(r => setTimeout(r, 2500))
    clearInterval(timer)
    setLoadingText('')

    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, emotion, persona }),
      })

      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })

        if (buffer.includes('<<<ACTION>>>')) {
          const [text, actionStr] = buffer.split('<<<ACTION>>>')
          setRawResponse(text.trim())
          const parsed = parseResponse(text.trim())
          setAnalysis(parsed.analysis)
          setPunchline(parsed.punchline)
          try { setAction(JSON.parse(actionStr.trim())) } catch {}
          break
        } else {
          setRawResponse(buffer)
          const parsed = parseResponse(buffer)
          setAnalysis(parsed.analysis)
          setPunchline(parsed.punchline)
        }
      }
      track('response_done', { persona, emotion })
      setDone(true)
    } catch {
      setAnalysis('出了点问题，请稍后再试。')
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  const handlePersonaChange = (id: string) => {
    setPersona(id)
    localStorage.setItem('preferred_persona', id)
    setStarted(false)
    setRawResponse('')
    setAnalysis('')
    setPunchline('')
    setAction(null)
    setDone(false)
    setActionDone(false)
  }

  const handleFinish = () => {
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    entries.unshift({
      id: Date.now(),
      emotion,
      content,
      persona,
      response: rawResponse,
      analysis,
      punchline,
      action,
      createdAt: new Date().toISOString(),
      emotionStart: parseInt(sessionStorage.getItem('emotion_score') || '7'),
      sessions: [],
      status: 'processing',
    })
    localStorage.setItem('entries', JSON.stringify(entries))
    sessionStorage.removeItem('entry_content')
    sessionStorage.removeItem('entry_emotion')
    router.push('/done')
  }

  const currentPersona = PERSONAS.find(p => p.id === persona)

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
        <p style={{ color: 'var(--text-main)', fontSize: '16px', fontWeight: '300', letterSpacing: '0.08em' }}>
          选一个陪你的人
        </p>
      </div>

      {/* 角色选择 */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {PERSONAS.map(p => (
          <button
            key={p.id}
            onClick={() => handlePersonaChange(p.id)}
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

      {/* 用户内容（缩小暗化） */}
      {started && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <p style={{
            color: 'var(--text-muted)', fontSize: '12px',
            lineHeight: '1.7', opacity: 0.4,
          }}>
            {content.length > 80 ? content.slice(0, 80) + '...' : content}
          </p>
        </div>
      )}

      {/* 开始按钮 */}
      {!started && (
        <button
          onClick={handleStart}
          style={{
            width: '100%', padding: '15px', borderRadius: '12px',
            border: `1px solid ${currentPersona?.color}50`,
            background: `${currentPersona?.color}10`,
            color: currentPersona?.color,
            fontSize: '14px', letterSpacing: '0.15em', cursor: 'pointer',
          }}
        >
          {PERSONA_BUTTONS[persona] || `交给 ${persona}`}
        </button>
      )}

      {/* 拟人化加载 */}
      {loading && loadingText && (
        <div style={{
          padding: '20px 24px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: currentPersona?.color,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <p style={{
            color: 'var(--text-muted)', fontSize: '13px',
            lineHeight: '1.8', opacity: 0.7,
            transition: 'opacity 0.5s ease',
          }}>
            {loadingText}
          </p>
        </div>
      )}

      {/* 第1层：解析区 */}
      {analysis && (
        <div style={{
          padding: '20px 24px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
        }}>
          <p style={{
            color: 'var(--text-main)', fontSize: '15px',
            lineHeight: '1.9', letterSpacing: '0.03em',
            opacity: 0.85,
          }}>
            {analysis}
          </p>
        </div>
      )}

      {/* 第2层：主旨区（视觉暴击） */}
      {punchline && (
        <div style={{
          padding: '32px 24px',
          margin: '8px 0',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${currentPersona?.color}30`,
          textAlign: 'center',
        }}>
          <p style={{
            color: 'var(--text-main)',
            fontSize: '20px',
            fontWeight: '500',
            lineHeight: '1.7',
            letterSpacing: '0.05em',
          }}>
            {punchline}
          </p>
        </div>
      )}

      {/* 第3层：小动作卡片 */}
      {action && (
        <div style={{
          padding: '20px 24px', borderRadius: '12px',
          background: 'rgba(245,200,66,0.05)',
          border: '1px solid rgba(245,200,66,0.2)',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', letterSpacing: '0.2em' }}>
            现在，做这一件事
          </p>
          <p style={{ color: 'var(--text-main)', fontSize: '16px', lineHeight: '1.6' }}>
            {action.text}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8', opacity: 0.8 }}>
            {action.sub}
          </p>
          {!actionDone ? (
            <button
              onClick={() => setActionDone(true)}
              style={{
                marginTop: '4px', padding: '10px', borderRadius: '8px',
                border: '1px solid rgba(245,200,66,0.3)', background: 'transparent',
                color: 'var(--warm-yellow)', fontSize: '12px',
                letterSpacing: '0.15em', cursor: 'pointer',
              }}
            >
              做完了
            </button>
          ) : (
            <p style={{ color: 'var(--warm-yellow)', fontSize: '12px', opacity: 0.6, letterSpacing: '0.1em' }}>
              ✓ 很好。
            </p>
          )}
        </div>
      )}

      {/* 收入档案按钮 */}
      {done && (
        <button
          onClick={handleFinish}
          style={{
            width: '100%', padding: '15px', borderRadius: '12px',
            border: '1px solid rgba(245,200,66,0.3)',
            background: 'rgba(245,200,66,0.08)',
            color: 'var(--warm-yellow)', fontSize: '14px',
            letterSpacing: '0.2em', cursor: 'pointer',
          }}
        >
          到此为止
        </button>
      )}

      {!loading && !started && (
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

      <div ref={bottomRef} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}