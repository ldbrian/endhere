'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PERSONAS, getRandomAction } from '../lib/personas'

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

function parseResponse(raw: string): { analysis: string; punchline: string } {
  const analysisMatch = raw.match(/<解析>([\s\S]*?)<\/解析>/)
  const punchlineMatch = raw.match(/<主旨>([\s\S]*?)<\/主旨>/)
  return {
    analysis: analysisMatch ? analysisMatch[1].trim() : '',
    punchline: punchlineMatch ? punchlineMatch[1].trim() : '',
  }
}

function RuminateContent() {
  const [entry, setEntry] = useState<any>(null)
  const [supplement, setSupplement] = useState('')
  const [persona, setPersona] = useState('Rin')
  const [response, setResponse] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [punchline, setPunchline] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const [scoreEnd, setScoreEnd] = useState(5)
  const [saved, setSaved] = useState(false)
  const [actionDone, setActionDone] = useState(false)
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
  }, [analysis, punchline, action])

  const currentPersona = PERSONAS.find(p => p.id === persona)

  const handleStart = async () => {
    if (!entry || loading) return
    setStarted(true)
    setLoading(true)
    setResponse('')
    setAnalysis('')
    setPunchline('')
    setAction(null)
    setDone(false)
    setActionDone(false)

    setLoadingText(getRandomAction(persona))
    const timer = setInterval(() => {
      setLoadingText(getRandomAction(persona))
    }, 1500)

    await new Promise(r => setTimeout(r, 2500))
    clearInterval(timer)
    setLoadingText('')

    const systemPrompt = `你是${persona}，正在对一个用户进行情绪"复查"。
用户之前记录了一件让他难受的事，现在回来了。

输出格式严格如下，不得更改：
<解析>此处写2-3句话。感知用户现在对这件事的状态，说出你观察到的变化或停滞。像真正在看着他的人。</解析>
<主旨>此处写1句话。帮助他再往前走一点点的话。不需要解决，只需要松动。一针见血，有重量。</主旨>

规则：
- 根据${persona}的性格来说话
- 不说教，不给大道理
- 像真人，不像治疗师`

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
          const parsed = parseResponse(text.trim())
          setAnalysis(parsed.analysis)
          setPunchline(parsed.punchline)
          try { setAction(JSON.parse(actionStr.trim())) } catch {}
          break
        } else {
          setResponse(buffer)
          const parsed = parseResponse(buffer)
          setAnalysis(parsed.analysis)
          setPunchline(parsed.punchline)
        }
      }
      setDone(true)
    } catch {
      setAnalysis('出了点问题，请稍后再试。')
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
        analysis,
        punchline,
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
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.5, lineHeight: '1.7' }}>
          {entry.content.length > 40 ? entry.content.slice(0, 40) + '...' : entry.content}
        </p>
        {/* 当前角色 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <span style={{
            padding: '2px 10px', borderRadius: '999px',
            border: `1px solid ${currentPersona?.color}40`,
            color: currentPersona?.color, fontSize: '11px',
          }}>
            {persona} 陪你
          </span>
        </div>
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

      {/* 用户补充内容缩小暗化 */}
      {started && supplement && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.4 }}>
            {supplement}
          </p>
        </div>
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
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', opacity: 0.7 }}>
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
            lineHeight: '1.9', letterSpacing: '0.03em', opacity: 0.85,
          }}>
            {analysis}
          </p>
        </div>
      )}

      {/* 第2层：主旨区 */}
      {punchline && (
        <div style={{
          padding: '32px 24px', margin: '8px 0',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${currentPersona?.color}30`,
          textAlign: 'center',
        }}>
          <p style={{
            color: 'var(--text-main)', fontSize: '20px',
            fontWeight: '500', lineHeight: '1.7', letterSpacing: '0.05em',
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
          {!actionDone ? (
            <button
              onClick={() => setActionDone(true)}
              style={{
                padding: '10px', borderRadius: '8px',
                border: '1px solid rgba(245,200,66,0.3)', background: 'transparent',
                color: 'var(--warm-yellow)', fontSize: '12px',
                letterSpacing: '0.15em', cursor: 'pointer',
              }}
            >
              做完了
            </button>
          ) : (
            <p style={{ color: 'var(--warm-yellow)', fontSize: '12px', opacity: 0.6 }}>✓ 很好。</p>
          )}
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

      {/* 保存后按钮 */}
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
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