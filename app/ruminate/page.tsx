'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PERSONAS, getRandomAction } from '../lib/personas'
import { track } from '../lib/track'
import { getMemoryPromptContext, updateCustomerVibe } from '../lib/memory'
import { useBasketClaim } from '../hooks/useBasketClaim' // 引入拦截器

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

function parseResponse(raw: string): { analysis: string; punchline: string; vibeTag: string } {
  const analysisMatch = raw.match(/<解析>([\s\S]*?)<\/解析>/)
  const punchlineMatch = raw.match(/<主旨>([\s\S]*?)<\/主旨>/)
  const vibeMatch = raw.match(/<交接班印象>([\s\S]*?)<\/交接班印象>/)
  return {
    analysis: analysisMatch ? analysisMatch[1].trim() : '',
    punchline: punchlineMatch ? punchlineMatch[1].trim() : '',
    vibeTag: vibeMatch ? vibeMatch[1].trim() : '',
  }
}

function RuminateContent() {
  const [entry, setEntry] = useState<any>(null)
  const [supplement, setSupplement] = useState('')
  const [persona, setPersona] = useState('Rin')
  const [response, setResponse] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [punchline, setPunchline] = useState('')
  const [vibeTag, setVibeTag] = useState('') 
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

  // === 引入命中拦截器 ===
  const { checkBasket, takeGift, returnGift } = useBasketClaim()
  const [queuedGift, setQueuedGift] = useState<any>(null)

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
  }, [analysis, punchline, action, queuedGift]) // 确保弹窗时也能滚动到底部

  const currentPersona = PERSONAS.find(p => p.id === persona)

  const handleStart = async () => {
    if (!entry || loading) return
    setStarted(true)
    setLoading(true)
    setResponse('')
    setAnalysis('')
    setPunchline('')
    setVibeTag('') 
    setAction(null)
    setDone(false)
    setActionDone(false)

    setLoadingText(getRandomAction(persona))
    const timer = setInterval(() => { setLoadingText(getRandomAction(persona)) }, 1500)
    await new Promise(r => setTimeout(r, 2500))
    clearInterval(timer)
    setLoadingText('')

    const systemPrompt = `你现在的身份是：${persona}。
（注：Ash是仗义嘴毒的过命兄弟；Rin是无条件护短的贴心姐妹；Child是8岁时天真清澈的用户自己）
用户之前向你倾诉过一件破事，现在他再次打开这个档案，回来找你“复查”这件事。

输出格式严格如下，不得更改：
<解析>此处写1-2句话。用你当前的专属身份，感知用户现在对这件事的状态。像活人一样说话，绝不能像心理医生！</解析>
<主旨>此处写1句话。一句符合你身份的大白话，帮他物理切断此刻的回忆内耗，叫他回到现实里去。</主旨>
<命运物件>
ID: [从 broken_scale, cracked_bowl, rusty_anchor 中选一个]
NAME: [为他这次的回头复查，起一个带刺的物件名字]
DESC: [写一句15字以内的文案]
</命运物件>
<交接班印象>用一句15字以内的市井大白话，概括你对该用户今天复查状态的印象。</交接班印象>`

    const memoryContext = getMemoryPromptContext()
    const userMessage = `用户原始记录：${entry.content}
用户当时情绪：${entry.emotion}，难受程度：${entry.emotionStart}/10
用户现在补充：${supplement || '（没有补充，沉默回来了）'}
${memoryContext}` 

    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessage,
          emotion: entry.emotion,
          persona,
          systemPrompt,
          clientHour: new Date().getHours(),
          memoryContext,
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
          setVibeTag(parsed.vibeTag) 
          try { setAction(JSON.parse(actionStr.trim())) } catch {}
          break
        } else {
          setResponse(buffer)
          const parsed = parseResponse(buffer)
          setAnalysis(parsed.analysis)
          setPunchline(parsed.punchline)
          setVibeTag(parsed.vibeTag)
        }
      }
      track('ruminate_done', { persona, supplement_length: supplement.length })
      setDone(true)
    } catch {
      setAnalysis('出了点问题，请稍后再试。')
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (vibeTag) updateCustomerVibe(vibeTag)

    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    const idx = entries.findIndex((e: any) => String(e.id) === String(entryId))
    if (idx !== -1) {
      const status = getStatusByScore(scoreEnd)
      entries[idx].emotionEnd = scoreEnd
      entries[idx].status = status.label
      if (!entries[idx].sessions) entries[idx].sessions = []
      entries[idx].sessions.push({
        id: Date.now(),
        supplement, persona, response, analysis, punchline, action, scoreEnd,
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('entries', JSON.stringify(entries))
    }
    setSaved(true)
  }

  // === 拦截层：点击“打出小票”时，尝试拦截一根火柴 ===
  const initiateProceedToCounter = async () => {
    track('ruminate_try_proceed', { entry_id: entryId })
    const gift = await checkBasket('match')
    if (gift) {
      setQueuedGift(gift) // 命中火柴，弹窗拦截
    } else {
      performProceedToCounter() // 没命中，按原计划走
    }
  }

  // 原本走向收银台的逻辑
  const performProceedToCounter = () => {
    track('ruminate_to_counter', { entry_id: entryId })
    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    const idx = entries.findIndex((e: any) => String(e.id) === String(entryId))
    if (idx > 0) {
      const [item] = entries.splice(idx, 1)
      entries.unshift(item)
      localStorage.setItem('entries', JSON.stringify(entries))
    }
    router.push('/destroy')
  }

  const status = getStatusByScore(scoreEnd)

  if (!entry) return <div style={{ padding: '60px 24px', color: 'var(--text-muted)' }}>找不到这条记录</div>

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '60px 24px' }}>
      
      {/* 顶部 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>END HERE</p>
        <h1 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: '300', letterSpacing: '0.08em' }}>你回来了</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.5, lineHeight: '1.7' }}>
          {entry.content.length > 40 ? entry.content.slice(0, 40) + '...' : entry.content}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <span style={{ padding: '2px 10px', borderRadius: '999px', border: `1px solid ${currentPersona?.color}40`, color: currentPersona?.color, fontSize: '11px' }}>
            {persona} 陪你
          </span>
        </div>
      </div>

      {!started && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>这件事现在还在吗？可以说说，也可以什么都不说。</p>
          <textarea value={supplement} onChange={(e) => setSupplement(e.target.value)} placeholder="（选填）" rows={4} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.8', fontFamily: 'inherit' }} />
        </div>
      )}

      {!started && (
        <button onClick={handleStart} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${currentPersona?.color}50`, background: `${currentPersona?.color}10`, color: currentPersona?.color, fontSize: '14px', letterSpacing: '0.15em', cursor: 'pointer' }}>
          让 {persona} 来复查
        </button>
      )}

      {started && supplement && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.4 }}>{supplement}</p>
        </div>
      )}

      {loading && loadingText && (
        <div style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentPersona?.color, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', opacity: 0.7 }}>{loadingText}</p>
        </div>
      )}

      {analysis && (
        <div style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-main)', fontSize: '15px', lineHeight: '1.9', letterSpacing: '0.03em', opacity: 0.85 }}>{analysis}</p>
        </div>
      )}

      {punchline && (
        <div style={{ padding: '32px 24px', margin: '8px 0', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${currentPersona?.color}30`, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-main)', fontSize: '20px', fontWeight: '500', lineHeight: '1.7', letterSpacing: '0.05em' }}>{punchline}</p>
        </div>
      )}

      {action && (
        <div style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(245,200,66,0.05)', border: '1px solid rgba(245,200,66,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', letterSpacing: '0.2em' }}>现在，做这一件事</p>
          <p style={{ color: 'var(--text-main)', fontSize: '15px', lineHeight: '1.6' }}>{action.text}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8', opacity: 0.8 }}>{action.sub}</p>
          {!actionDone ? (
            <button onClick={() => setActionDone(true)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(245,200,66,0.3)', background: 'transparent', color: 'var(--warm-yellow)', fontSize: '12px', letterSpacing: '0.15em', cursor: 'pointer' }}>做完了</button>
          ) : (
            <p style={{ color: 'var(--warm-yellow)', fontSize: '12px', opacity: 0.6 }}>✓ 很好。</p>
          )}
        </div>
      )}

      {done && !saved && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>现在难受程度</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: status.color, fontSize: '11px', letterSpacing: '0.1em' }}>{status.label}</span>
            <span style={{ color: 'var(--warm-yellow)', fontSize: '20px', fontWeight: '300' }}>{scoreEnd}</span>
          </div>
          <input type="range" min={1} max={10} value={scoreEnd} onChange={(e) => setScoreEnd(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--warm-yellow)', cursor: 'pointer' }} />
          <button onClick={handleSave} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.08)', color: 'var(--warm-yellow)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer' }}>更新复查记录</button>
        </div>
      )}

      {saved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.5s ease' }}>
          <button
            onClick={initiateProceedToCounter}
            style={{
              width: '100%', padding: '16px', borderRadius: '12px',
              border: '1px dashed var(--warm-yellow)', background: 'rgba(245,200,66,0.08)',
              color: 'var(--warm-yellow)', fontSize: '14px', fontWeight: 'bold',
              letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            打出小票，准备销毁
          </button>
        </div>
      )}

      {/* 命运拦截 UI：火柴 */}
      {queuedGift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,16,14,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#1e1c18', border: '1px solid rgba(245,200,66,0.3)', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', animation: 'toastSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', letterSpacing: '0.2em', margin: 0 }}>
              【 铁筐里有陌生人留下的火柴 】
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
              <button onClick={async () => {
                await takeGift(queuedGift.id)
                // 收下火柴，直接带着 strangerMatch=true 的参数去销毁页，让那边的火烧得更旺
                const entries = JSON.parse(localStorage.getItem('entries') || '[]')
                const idx = entries.findIndex((e: any) => String(e.id) === String(entryId))
                if (idx > 0) {
                  const [item] = entries.splice(idx, 1)
                  entries.unshift(item)
                  localStorage.setItem('entries', JSON.stringify(entries))
                }
                router.push('/destroy?strangerMatch=true')
              }} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: '1px solid rgba(245,200,66,0.5)', background: 'rgba(245,200,66,0.1)', color: 'var(--warm-yellow)', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.1em', cursor: 'pointer' }}>
                收下，划亮它去烧小票
              </button>
              
              <button onClick={async () => {
                await returnGift(queuedGift.id)
                performProceedToCounter() // 放回火柴，按原计划走
              }} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', opacity: 0.7 }}>
                放回去
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
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