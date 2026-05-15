'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const PERSONAS = [
  { id: 'Ash', label: 'Ash', desc: '毒舌但精准', color: 'var(--ash-color)' },
  { id: 'Rin', label: 'Rin', desc: '暖心共情', color: 'var(--rin-color)' },
  { id: 'Sol', label: 'Sol', desc: '热血打气', color: 'var(--sol-color)' },
]

const EMOTION_LABELS: Record<string, string> = {
  regret: '后悔', grievance: '委屈', unwilling: '不甘', irritated: '烦躁', sad: '难过',
}

export default function ResponsePage() {
  const [persona, setPersona] = useState('Rin')
  const [content, setContent] = useState('')
  const [emotion, setEmotion] = useState('sad')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const router = useRouter()
  const responseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const savedContent = sessionStorage.getItem('entry_content') || ''
    const savedEmotion = sessionStorage.getItem('entry_emotion') || 'sad'
    const savedPersona = localStorage.getItem('preferred_persona') || 'Rin'
    setContent(savedContent)
    setEmotion(savedEmotion)
    setPersona(savedPersona)
  }, [])

  const handleStart = async () => {
    if (!content || loading) return
    setStarted(true)
    setLoading(true)
    setResponse('')
    setDone(false)

    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, emotion, persona }),
      })

      if (!res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        const text = decoder.decode(value, { stream: true })
        setResponse(prev => prev + text)
        // 自动滚动
        if (responseRef.current) {
          responseRef.current.scrollTop = responseRef.current.scrollHeight
        }
      }

      setDone(true)
    } catch (e) {
      setResponse('出了点问题，请稍后再试。')
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  const handlePersonaChange = (id: string) => {
    setPersona(id)
    localStorage.setItem('preferred_persona', id)
    // 切换角色后重新生成
    setStarted(false)
    setResponse('')
    setDone(false)
  }

  const handleFinish = () => {
    // 存入本地档案
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    entries.unshift({
      id: Date.now(),
      emotion,
      content,
      persona,
      response,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('entries', JSON.stringify(entries))
    sessionStorage.removeItem('entry_content')
    sessionStorage.removeItem('entry_emotion')
    router.push('/done')
  }

  const currentPersona = PERSONAS.find(p => p.id === persona)

  // 把回应按"---"分成三段
  const sections = response.split('---').map(s => s.trim()).filter(Boolean)

  return (
    <div style={{
      width: '100%',
      maxWidth: '360px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      padding: '60px 24px',
    }}>

      {/* 顶部 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>
          END HERE
        </p>
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
              flex: 1,
              padding: '12px 8px',
              borderRadius: '10px',
              border: `1px solid ${persona === p.id ? p.color : 'var(--border)'}`,
              background: persona === p.id ? `${p.color}15` : 'transparent',
              color: persona === p.id ? p.color : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{p.label}</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>{p.desc}</span>
          </button>
        ))}
      </div>

      {/* 开始按钮 */}
      {!started && (
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '12px',
            border: `1px solid ${currentPersona?.color}50`,
            background: `${currentPersona?.color}10`,
            color: currentPersona?.color,
            fontSize: '14px',
            letterSpacing: '0.15em',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          让 {persona} 来陪我
        </button>
      )}

      {/* AI回应区域 */}
      {started && (
        <div
          ref={responseRef}
          style={{
            maxHeight: '55vh',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          <div style={{
            padding: '20px 24px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
          }}>
            {sections.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sections.map((section, i) => (
                  <p
                    key={i}
                    style={{
                      color: 'var(--text-main)',
                      fontSize: '15px',
                      lineHeight: '1.9',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {section}
                  </p>
                ))}
              </div>
            ) : (
              <p style={{
                color: 'var(--text-main)',
                fontSize: '15px',
                lineHeight: '1.9',
                opacity: 0.7,
              }}>
                {response || '···'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 完成按钮 */}
      {done && (
        <button
          onClick={handleFinish}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '12px',
            border: '1px solid rgba(245,200,66,0.3)',
            background: 'rgba(245,200,66,0.08)',
            color: 'var(--warm-yellow)',
            fontSize: '14px',
            letterSpacing: '0.2em',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          到此为止
        </button>
      )}

      {/* 返回 */}
      {!loading && (
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            opacity: 0.5,
            letterSpacing: '0.1em',
          }}
        >
          ← 返回
        </button>
      )}

    </div>
  )
}