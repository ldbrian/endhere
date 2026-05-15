'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const PERSONAS = [
  { id: 'Ash', label: 'Ash', desc: '毒舌但精准', color: 'var(--ash-color)' },
  { id: 'Rin', label: 'Rin', desc: '暖心共情', color: 'var(--rin-color)' },
  { id: 'Sol', label: 'Sol', desc: '热血打气', color: 'var(--sol-color)' },
]

function getStatusByScore(score: number) {
  if (score >= 8) return { label: '还在痛', color: '#e87070' }
  if (score >= 5) return { label: '好一点了', color: 'var(--warm-yellow)' }
  if (score >= 3) return { label: '快放下了', color: '#a0c4a0' }
  return { label: '到此为止', color: 'var(--text-muted)' }
}

interface Action {
  id: string
  text: string
  sub: string
}

function RuminateContent() {
  const [entry, setEntry] = useState<any>(null)
  const [supplement, setSupplement] = useState('')
  const [persona, setPersona] = useState('Rin')
  const [response, setResponse] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const [scoreEnd, setScoreEnd] = useState(5)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const entryId = searchParams.get('id')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    const found = entries.find((e: any) => String(e.id) === String(entryId))
    if (found) {
      setEntry(found)
      setPersona(found.persona || 'Rin')
      setScoreEnd(found.emotionEnd || 5)
    }
  }, [entryId])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [response, action])

  const handleStart = async () => {
    if (!entry || loading) return
    setStarted(true)
    setLoading(true)
    setResponse('')
    setAction(null)
    setDone(false)

    const systemPrompt = `你是${persona}，正在对一个用户进行情绪"复查"。
用户之前记录了一件让他难受的事，现在回来了。
你的任务是：感知用户现在对这件事的状态，给出温柔但有力的回应。
回应分两段，用"---"分隔，不要任何标签。
第一段：根据用户的补充（或沉默），感知他现在的状态，说出你观察到的变化或停滞。2-3句。
第二段：给一个新的视角或一句话，帮助他再往前走一点点。不需要解决，只需要松动。1-2句。
语气根据角色性格来，像真人，不像治疗师。`

    const userMessage = `用户原始记录：${entry.content}
用户当时情绪：${entry.emotion}，难受程度：${entry.emotionStart}/10
用户现在补充：${supplement || '（没有补充，沉默回来了）'}`

    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessage,
          emotion: entry.emotion,
          persona,
          systemPrompt,
        }),
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
          setResponse(text.trim())
          try { setAction(JSON.parse(actionStr.trim())) } catch {}
          break
        } else {
          setResponse(buffer)
        }
      }
      setDone(true)
    } catch {
      setResponse('出了点问题，请稍后再试。')
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    const idx = entries.findIndex((e: any) => String(e.id) === String(entryId))
    if (idx !== -1) {
      const status = getStatusByScore(scoreEnd)
      entries[idx].emotionEnd = scoreEnd
      entries[idx].status = status.label
      if (!entries[idx].sessions) entries[idx].sessions = []
      entries[idx].sessions.push({
        id: Date.now(),
        supplement,
        persona,
        response,
        action,
        scoreEnd,
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('entries', JSON.stringify(entries))
    }
    setSaved(true)
  }

  const handleRelease = () => {
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    const idx = entries.findIndex((e: any) => String(e.id) === String(entryId))
    if (idx !== -1) {
      entries[idx].status = '到此为止'
      entries[idx].released = true
      entries[idx].releasedAt = new Date().toISOString()
      localStorage.setItem('entries', JSON.stringify(entries))
    }
    router.push('/release')
  }

  const currentPersona = PERSONAS.find(p => p.id === persona)
  const sections = response.split('---').map(s => s.trim()).filter(Boolean)
  const status = getStatusByScore(scoreEnd)

  if (!entry) return (
    <div style={{ padding: '60px 24px', color: 'var(--text-muted)', fontSize: '14px' }}>
      找不到这条记录
    </div>
  )

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
        <h1 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: '300', letterSpacing: '0.08em' }}>
          你回来了
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6, lineHeight: '1.7' }}>
          {entry.content.length > 40 ? entry.content.slice(0, 40) + '...' : entry.content}
        </p>
      </div>

      {/* 补充输入 */}
      {!started && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>
            这件事现在还在吗？可以说说，也可以什么都不说。
          </p>
          <textarea
            value={supplement}
            onChange={(e) => setSupplement(e.target.value)}
            placeholder="（选填）"
            rows={4}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              color: 'var(--text-main)',
              fontSize: '14px',
              lineHeight: '1.8',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {/* 角色选择 */}
      {!started && (
        <div style={{ display: 'flex', gap: '10px' }}>
          {PERSONAS.map(p => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: '10px',
                border: `1px solid ${persona === p.id ? p.color : 'var(--border)'}`,
                background: persona === p.id ? `${p.color}15` : 'transparent',
                color: persona === p.id ? p.color : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.25s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: '500' }}>{p.label}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{p.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* 开始按钮 */}
      {!started && (
        <button
          onClick={handleStart}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px',
            border: `1px solid ${currentPersona?.color}50`,
            background: `${currentPersona?.color}10`,
            color: currentPersona?.color,
            fontSize: '14px', letterSpacing: '0.15em', cursor: 'pointer',
          }}
        >
          让 {persona} 来复查
        </button>
      )}

      {/* AI回应 */}
      {started && sections.length > 0 && (
        <div style={{
          padding: '20px 24px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {sections.map((section, i) => (
            <p key={i} style={{
              color: 'var(--text-main)', fontSize: '15px',
              lineHeight: '1.9', letterSpacing: '0.03em',
            }}>
              {section}
            </p>
          ))}
          {loading && <p style={{ color: 'var(--text-muted)', fontSize: '13px', opacity: 0.5 }}>···</p>}
        </div>
      )}

      {started && sections.length === 0 && response && (
        <div style={{
          padding: '20px 24px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
        }}>
          <p style={{ color: 'var(--text-main)', fontSize: '15px', lineHeight: '1.9', opacity: 0.8 }}>
            {response}
          </p>
        </div>
      )}

      {started && !response && loading && (
        <div style={{
          padding: '20px 24px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', opacity: 0.5 }}>···</p>
        </div>
      )}

      {/* 小动作卡片 */}
      {action && (
        <div style={{
          padding: '20px 24px', borderRadius: '12px',
          background: 'rgba(245,200,66,0.05)',
          border: '1px solid rgba(245,200,66,0.2)',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', letterSpacing: '0.2em' }}>
            现在，做这一件事
          </p>
          <p style={{ color: 'var(--text-main)', fontSize: '15px', lineHeight: '1.6' }}>
            {action.text}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8', opacity: 0.8 }}>
            {action.sub}
          </p>
        </div>
      )}

      {/* 结束评分 */}
      {done && !saved && (
        <div style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: '14px',
          padding: '20px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>
            现在难受程度
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: status.color, fontSize: '11px', letterSpacing: '0.1em' }}>
              {status.label}
            </span>
            <span style={{ color: 'var(--warm-yellow)', fontSize: '20px', fontWeight: '300' }}>
              {scoreEnd}
            </span>
          </div>
          <input
            type="range" min={1} max={10} value={scoreEnd}
            onChange={(e) => setScoreEnd(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--warm-yellow)', cursor: 'pointer' }}
          />
          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              border: '1px solid rgba(245,200,66,0.3)',
              background: 'rgba(245,200,66,0.08)',
              color: 'var(--warm-yellow)', fontSize: '13px',
              letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            更新档案
          </button>
        </div>
      )}

      {/* 保存后的按钮 */}
      {saved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleRelease}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: '1px solid rgba(160,196,160,0.3)',
              background: 'rgba(160,196,160,0.06)',
              color: '#a0c4a0', fontSize: '13px',
              letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            我想彻底放下它
          </button>
          <button
            onClick={() => router.push('/archive')}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: '13px',
              letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            回到档案
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

export default function RuminatePage() {
  return (
    <Suspense>
      <RuminateContent />
    </Suspense>
  )
}