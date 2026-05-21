'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PERSONAS, getRandomAction } from '../lib/personas'
import { track, checkLimit } from '../lib/track'
import { extractAndSaveMemory, getMemoryPromptContext } from '../lib/memory'

const EMOTION_LABELS: Record<string, string> = {
  regret: '后悔', grievance: '委屈', unwilling: '不甘', irritated: '烦躁', sad: '难过',
}

interface DestinedItem {
  id: string
  name: string
  desc: string
}

function parseResponse(raw: string): { analysis: string; punchline: string } {
  const analysisMatch = raw.match(/<解析>([\s\S]*?)<\/解析>/)
  const punchlineMatch = raw.match(/<主旨>([\s\S]*?)<\/主旨>/)
  return {
    analysis: analysisMatch ? analysisMatch[1].trim() : '',
    punchline: punchlineMatch ? punchlineMatch[1].trim() : '',
  }
}

function parseItem(raw: string): DestinedItem | null {
  const match = raw.match(/<命运物件>([\s\S]*?)<\/命运物件>/)
  if (!match) return null
  const content = match[1]
  const idMatch = content.match(/ID:\s*([^\n]+)/)
  const nameMatch = content.match(/NAME:\s*([^\n]+)/)
  const descMatch = content.match(/DESC:\s*([^\n]+)/)
  return {
    id: idMatch ? idMatch[1].trim() : 'rusty_anchor',
    name: nameMatch ? nameMatch[1].trim() : '不具名的情绪碎屑',
    desc: descMatch ? descMatch[1].trim() : '带走它，今晚到此为止。',
  }
}

export default function ResponsePage() {
  const [persona, setPersona] = useState('Rin')
  const [content, setContent] = useState('')
  const [emotion, setEmotion] = useState('sad')
  const [rawResponse, setRawResponse] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [punchline, setPunchline] = useState('')
  const [destinedItem, setDestinedItem] = useState<DestinedItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const [actionDone, setActionDone] = useState(false)
  const [childName, setChildName] = useState('8岁的自己')
  const [emotionScore, setEmotionScore] = useState('7')
  
  const [showRebuttalInput, setShowRebuttalInput] = useState(false)
  const [rebuttalText, setRebuttalText] = useState('')
  const [isRebutting, setIsRebutting] = useState(false)
  const [rebuttalAnalysis, setRebuttalAnalysis] = useState('')
  const [rebuttalPunchline, setRebuttalPunchline] = useState('')
  const [rebuttalDone, setRebuttalDone] = useState(false)
  
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const savedContent = sessionStorage.getItem('entry_content') || ''
    const savedEmotion = sessionStorage.getItem('entry_emotion') || 'sad'
    const savedPersona = localStorage.getItem('preferred_persona') || 'Rin'
    const savedScore = sessionStorage.getItem('emotion_score') || '7'
    const savedChildName = localStorage.getItem('child_nickname') || '8岁的自己'
    
    setContent(savedContent)
    setEmotion(savedEmotion)
    setPersona(savedPersona)
    setEmotionScore(savedScore)
    setChildName(savedChildName)
  }, [])

  useEffect(() => {
    if (content && persona && !started) {
      handleStart()
    }
  }, [content, persona])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [analysis, punchline, actionDone, showRebuttalInput, rebuttalPunchline])

  const handleStart = async () => {
    if (!content || loading) return
    
    // === 1. 发起后端额度校验 ===
    const limit = await checkLimit()
    
    // === 2. 获取本地的“特权暗号”状态 ===
    const isVip = localStorage.getItem('is_lifetime_vip') === 'true'
    const hasExtra = localStorage.getItem('extra_limit_granted') === '3'

    // === 3. 核心拦截：如果没有额度，且没有特权，强行踢客 ===
    if (!limit.allowed && !isVip && !hasExtra) {
      alert(`🏪 店长留客通知：\n\n今天你已经来过小店宣泄过了（已达 ${limit.limit} 次上限）。\n避难所灯火再温暖，过去的也不该贪恋。\n\n请先去做那件你一直拖着的事，明天深夜，店长再为你亮灯。`)
      setAnalysis('今天已经来过避难所了。卷帘门已拉下，请回到现实去。')
      setStarted(true)
      setDone(true)
      // 强行踢回首页，绝不留情
      setTimeout(() => { router.push('/') }, 2000)
      return
    }

    // === 4. 抵扣临时能量包 ===
    if (!limit.allowed && hasExtra) {
      localStorage.removeItem('extra_limit_granted') // 消耗掉这次临时买来的额度
    }

    setStarted(true)
    setLoading(true)

    const getNextAction = () => getRandomAction(persona, localStorage.getItem('child_nickname') || '8岁的自己')
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
        body: JSON.stringify({ content, emotion, persona, clientHour: new Date().getHours() }),
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
          const [text] = buffer.split('<<<ACTION>>>')
          const cleanText = text.trim()
          setRawResponse(cleanText)
          const parsed = parseResponse(cleanText)
          setAnalysis(parsed.analysis)
          setPunchline(parsed.punchline)
          setDestinedItem(parseItem(cleanText))
          break
        } else {
          setRawResponse(buffer)
          const parsed = parseResponse(buffer)
          setAnalysis(parsed.analysis)
          setPunchline(parsed.punchline)
          setDestinedItem(parseItem(buffer))
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

  const handleRebuttalSubmit = async () => {
    if (!rebuttalText.trim() || isRebutting) return
    setIsRebutting(true)
    track('user_rebuttal', { persona, text_length: rebuttalText.length })

    const rebuttalSystemPrompt = `你现在的身份是：${persona}。（注：Ash是仗义嘴毒的兄弟，Rin是护短的贴心姐妹，Child是8岁时天真的用户自己）。
用户之前抱怨：“${content}”。
你刚才给他的建议是：“${punchline}”。
但他现在不服，并且正在向你顶嘴/抬杠：“${rebuttalText}”。

请用你当前的身份，给出最后一次绝杀回击！必须一针见血，彻底堵死他继续内耗的借口，并强行结束对话。

输出格式严格如下，不得更改：
<解析>一句话。点破他为什么还在嘴硬。</解析>
<主旨>一句话。你最后的通牒或绝杀回击。</主旨>
<命运物件>
ID: [从 broken_scale, cracked_bowl, rusty_anchor 中选一个]
NAME: [为他这次嘴硬起一个极其刺耳的物件名字，比如：还在找借口的破碗]
DESC: [一句15字以内的文案]
</命运物件>

规则：绝不准讲大道理！像活人对骂一样真实。`

    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: "用户正在顶嘴...", 
          emotion, 
          persona, 
          systemPrompt: rebuttalSystemPrompt,
          clientHour: new Date().getHours() // 同样偷运时间戳
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

        const cleanText = buffer.split('<<<ACTION>>>')[0]
        const parsed = parseResponse(cleanText)
        setRebuttalAnalysis(parsed.analysis)
        setRebuttalPunchline(parsed.punchline)
        const newItem = parseItem(cleanText)
        if (newItem) setDestinedItem(newItem) 
      }
      setRebuttalDone(true)
      setActionDone(true) 
    } catch {
      console.error('Rebuttal failed')
    } finally {
      setIsRebutting(false)
      setShowRebuttalInput(false)
    }
  }

  const handleFinish = () => {
    extractAndSaveMemory(content, emotion, persona) 

    const entries = JSON.parse(localStorage.getItem('entries') || '[]')
    entries.unshift({
      id: Date.now(),
      emotion,
      content,
      persona,
      response: rawResponse,
      analysis,
      punchline,
      destinedItem, 
      createdAt: new Date().toISOString(),
      emotionStart: parseInt(emotionScore),
      status: 'processed',
    })
    localStorage.setItem('entries', JSON.stringify(entries))
    sessionStorage.removeItem('entry_content')
    sessionStorage.removeItem('entry_emotion')
    router.push('/done')
  }

  const getCustomAction = () => {
    if (persona === 'Ash') {
      return { text: '找个信得过的人出来喝一杯，或者去街边摊狠狠搓一顿，算你的。', sub: '强行打断你当下的脑内死循环，身体动起来，现在就走。', btn: '听他的，这就走' }
    } else if (persona === 'Rin') {
      return { text: '现在立马收车/锁单回家，洗个热水澡，然后钻进被窝睡觉。', sub: '听她的，今晚不跟这个操蛋的世界死磕了。今天不受气了。', btn: '听她的，回家' }
    } else {
      return { text: `闭上眼，跟记忆里的「${childName}」握个手，或者抱一抱他。`, sub: `告诉他：长大的你没丢脸，你已经把他保护得很好、带得足够远了。`, btn: '好，抱抱当年的自己' }
    }
  }

  const actionConfig = getCustomAction()
  const currentPersona = PERSONAS.find(p => p.id === persona)
  const displayName = persona === 'Child' ? childName : currentPersona?.name

  const getItemIcon = (id: string) => {
    if (id === 'broken_scale') return '⚖️'
    if (id === 'cracked_bowl') return '🥣'
    return '⚓'
  }

  const isChild = persona === 'Child'

  return (
    <div style={{ 
      width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '60px 24px', margin: '0 auto',
      transition: 'all 0.8s ease',
      // === 核心魔法：童年泛黄滤镜 ===
      filter: isChild ? 'sepia(0.35) contrast(1.05) brightness(0.95)' : 'none',
      background: isChild ? '#161410' : 'transparent',
    }}>
      
      {/* 顶部指示 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>
          {isChild ? 'BACK THERE' : 'END HERE'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <span style={{ padding: '2px 12px', borderRadius: '999px', border: `1px solid ${currentPersona?.color}40`, color: currentPersona?.color, fontSize: '12px' }}>
            {displayName}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.5 }}>在听你说</span>
        </div>
      </div>

      {started && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.4 }}>
            {content.length > 80 ? content.slice(0, 80) + '...' : content}
          </p>
        </div>
      )}

      {loading && (
        <div style={{ padding: '32px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentPersona?.color, animation: `breathe 1.5s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }} />)}
          </div>
          {loadingText && <p style={{ color: 'var(--text-muted)', fontSize: '13px', opacity: 0.7, textAlign: 'center', animation: 'fadeText 0.5s ease-in-out' }}>{loadingText}</p>}
        </div>
      )}

      {analysis && (
        <div style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-main)', fontSize: '15px', lineHeight: '1.9', opacity: 0.85 }}>{analysis}</p>
        </div>
      )}

      {punchline && (
        <div style={{ padding: '32px 24px', margin: '8px 0', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${currentPersona?.color}30`, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-main)', fontSize: '20px', fontWeight: '500', lineHeight: '1.7' }}>{punchline}</p>
        </div>
      )}

      {/* 第一阶段行动卡片 */}
      {punchline && done && !rebuttalDone && (
        <div style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(245,200,66,0.03)', border: '1px solid rgba(245,200,66,0.15)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', letterSpacing: '0.2em' }}>现在，听建议做这件事</p>
          <p style={{ color: 'var(--text-main)', fontSize: '15px', lineHeight: '1.6', fontWeight: '500' }}>{actionConfig.text}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.7 }}>{actionConfig.sub}</p>
          
          {!showRebuttalInput && !actionDone ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => { track('action_completed', { persona }); setActionDone(true) }}
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.05)', color: 'var(--warm-yellow)', fontSize: '13px', cursor: 'pointer' }}
              >
                {actionConfig.btn}
              </button>
              <button
                onClick={() => setShowRebuttalInput(true)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', opacity: 0.4, cursor: 'pointer', padding: '8px', marginTop: '4px' }}
              >
                放屁，你根本不懂我...
              </button>
            </div>
          ) : showRebuttalInput && !isRebutting ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', animation: 'fadeText 0.3s ease-in' }}>
              <textarea
                value={rebuttalText}
                onChange={e => setRebuttalText(e.target.value)}
                placeholder="骂回去..."
                autoFocus
                rows={2}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '13px', outline: 'none', resize: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowRebuttalInput(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '6px', fontSize: '12px' }}>算了吧</button>
                <button onClick={handleRebuttalSubmit} disabled={!rebuttalText.trim()} style={{ flex: 2, padding: '10px', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.4)', color: 'var(--warm-yellow)', borderRadius: '6px', fontSize: '12px', opacity: rebuttalText.trim() ? 1 : 0.4 }}>发泄回去</button>
              </div>
            </div>
          ) : isRebutting ? (
            <p style={{ color: 'var(--warm-yellow)', fontSize: '12px', textAlign: 'center', marginTop: '12px', animation: 'breathe 1.5s infinite' }}>{displayName} 正在回击...</p>
          ) : null}
        </div>
      )}

      {/* 第二阶段：绝杀回击区域 */}
      {rebuttalDone && (
         <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeText 0.4s ease' }}>
           <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRight: '2px solid rgba(255,255,255,0.1)', borderRadius: '8px', alignSelf: 'flex-end', width: '90%' }}>
             <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>你的顶嘴：</p>
             <p style={{ color: 'var(--text-main)', fontSize: '13px', opacity: 0.8 }}>{rebuttalText}</p>
           </div>
           
           <div style={{ padding: '24px', borderRadius: '12px', background: `rgba(245,200,66,0.05)`, border: `1px solid ${currentPersona?.color}50` }}>
             <p style={{ color: currentPersona?.color, fontSize: '11px', letterSpacing: '0.1em', marginBottom: '12px' }}>{displayName} 的最后通牒</p>
             <p style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.8', opacity: 0.9, marginBottom: '12px' }}>{rebuttalAnalysis}</p>
             <p style={{ color: currentPersona?.color, fontSize: '18px', fontWeight: '500', lineHeight: '1.6' }}>{rebuttalPunchline}</p>
           </div>
         </div>
      )}

      {/* 命运物件收据小票 */}
      {actionDone && destinedItem && (
        <div style={{ padding: '24px', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'monospace, Courier', animation: 'fadeText 0.6s ease-out-forward' }}>
          <div style={{ textAlign: 'center', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>END HERE RECEIPT</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 0' }}>
            <span style={{ fontSize: '32px' }}>{getItemIcon(destinedItem.id)}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--warm-yellow)', fontSize: '15px', fontWeight: 'bold' }}>{destinedItem.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.8 }}>{destinedItem.desc}</span>
            </div>
          </div>
          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{rebuttalDone ? '嘴硬战损指数' : '情绪伤害烈度'}:</span>
            <span style={{ color: '#e87070', fontSize: '16px', fontWeight: 'bold' }}>{emotionScore} / 10</span>
          </div>
        </div>
      )}

      {actionDone && (
        <button onClick={handleFinish} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.08)', color: 'var(--warm-yellow)', fontSize: '14px', letterSpacing: '0.2em', cursor: 'pointer', animation: 'fadeText 0.3s ease-in' }}>
          到此为止
        </button>
      )}

      {!loading && !started && (
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', opacity: 0.5 }}>← 返回</button>
      )}

      <div ref={bottomRef} />

      <style>{`
        @keyframes breathe { 0%, 100% { opacity: 0.2; transform: translateY(0px); } 50% { opacity: 1; transform: translateY(-4px); } }
        @keyframes fadeText { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0px); } }
      `}</style>
    </div>
  )
}