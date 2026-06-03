'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PERSONAS, getRandomAction } from '../lib/personas'
import { track, checkLimit } from '../lib/track'
import { getMemoryPromptContext, updateCustomerVibe } from '../lib/memory'
import { useShelterStore } from '../store/useShelterStore' // <-- [CTO 注入] 引入全局 Store

// ==========================================
// 绝版组件：35秒时光抽屉 (一生一次) - 终极剧本版
// ==========================================
function ChildhoodDrawerOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState(0) 
  const [year, setYear] = useState(new Date().getFullYear())
  const [textIndex, setTextIndex] = useState(-1)
  const [showKillShot, setShowKillShot] = useState(false)

  const fragments = [
    "（电视杂音）\n“你趴在凉席上。”\n“动画片其实演了什么。”\n“已经记不清了。”",
    "（风扇声）\n“厨房里有人喊你吃饭。”\n“你回了一句：\n‘等会儿。’”"
  ]

  useEffect(() => {
    let startYear = new Date().getFullYear()
    let currentYear = startYear
    setPhase(1)

    const rInt = setInterval(() => {
      currentYear -= Math.floor(Math.random() * 3) + 1
      if (currentYear < 2000) currentYear = 2000
      setYear(currentYear)
    }, 80)

    const t1 = setTimeout(() => { clearInterval(rInt); setPhase(2); setTextIndex(0) }, 5000)
    const t2 = setTimeout(() => setTextIndex(1), 13000) 

    const t3 = setTimeout(() => { setPhase(3); setShowKillShot(false) }, 21000) 
    const t4 = setTimeout(() => setShowKillShot(true), 24500) 

    const t5 = setTimeout(() => {
      setPhase(4)
      const fInt = setInterval(() => {
        currentYear += Math.floor(Math.random() * 4) + 1
        if (currentYear >= startYear) {
          currentYear = startYear
          clearInterval(fInt)
        }
        setYear(currentYear)
      }, 60)
    }, 31500)

    const t6 = setTimeout(() => onClose(), 35000)

    return () => {
      clearInterval(rInt)
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      clearTimeout(t4); clearTimeout(t5); clearTimeout(t6)
    }
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {(phase === 1 || phase === 4) && (
        <div style={{ fontSize: '48px', fontFamily: 'monospace', color: '#fff', animation: phase === 1 ? 'rewindBlur 5s forwards' : 'forwardClear 3.5s forwards' }}>
          {year}
        </div>
      )}

      {phase === 2 && textIndex >= 0 && (
        <div key={textIndex} style={{ padding: '0 32px', textAlign: 'center', animation: 'drawerFade 7.5s ease-in-out forwards' }}>
          {fragments[textIndex].split('\n').map((line, i) => (
            <p 
              key={i} 
              style={{ 
                fontSize: line.startsWith('（') ? '13px' : '15px', 
                letterSpacing: '0.15em', 
                color: line.startsWith('（') ? '#888' : '#ccc',   
                lineHeight: '2.2',
                fontStyle: line.startsWith('（') ? 'italic' : 'normal',
                marginBottom: line.startsWith('（') ? '16px' : '4px' 
              }}
            >
              {line}
            </p>
          ))}
        </div>
      )}

      {phase === 3 && showKillShot && (
        <div style={{ padding: '0 32px', textAlign: 'center', animation: 'drawerFade 6s ease-in-out forwards' }}>
          <p style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', marginBottom: '32px', letterSpacing: '0.15em' }}>
            （所有声音突然消失）
          </p>
          <p style={{ fontSize: '15px', letterSpacing: '0.2em', color: '#fff', opacity: 0.9, lineHeight: '2.4', marginBottom: '8px' }}>
            “那时候。”
          </p>
          <p style={{ fontSize: '15px', letterSpacing: '0.2em', color: '#fff', opacity: 0.9, lineHeight: '2.4' }}>
            “你以为以后还有很多个夏天。”
          </p>
        </div>
      )}

      <style>{`
        @keyframes rewindBlur { 0% { filter: blur(0px); opacity: 1; transform: scale(1); } 100% { filter: blur(15px); opacity: 0; transform: scale(1.1); } }
        @keyframes forwardClear { 0% { filter: blur(15px); opacity: 0; transform: scale(0.9); } 100% { filter: blur(0px); opacity: 1; transform: scale(1); } }
        @keyframes drawerFade { 0% { opacity: 0; transform: scale(0.98); } 15% { opacity: 1; transform: scale(1); } 85% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.02); } }
      `}</style>
    </div>
  )
}
// ==========================================

const EMOTION_LABELS: Record<string, string> = {
  regret: '后悔', grievance: '委屈', unwilling: '不甘', irritated: '烦躁', sad: '难过',
}

interface DestinedItem {
  id: string
  name: string
  desc: string
}

function parseResponse(raw: string): { analysis: string; punchline: string; vibeTag: string } {
  const analysisMatch = raw.match(/<解析>([\s\S]*?)<\/解析>/)
  const punchlineMatch = raw.match(/<主旨>([\s\S]*?)<\/主旨>/)
  const vibeMatch = raw.match(/<交接班印象>([\s\S]*?)<\/交接班印象>/)
  
  let analysis = analysisMatch ? analysisMatch[1].trim() : ''
  let punchline = punchlineMatch ? punchlineMatch[1].trim() : ''
  const vibeTag = vibeMatch ? vibeMatch[1].trim() : ''

  // [CTO 防御性补丁] 极限兜底：如果 AI 完全没按规矩出牌（没有 <主旨>）
  // 强行提取干净的文本作为 punchline，确保前端按钮能够正常渲染出列！
  if (!analysis && !punchline && raw.trim()) {
    punchline = raw.replace(/<<<ACTION>>>/g, '').replace(/<[^>]+>/g, '').trim()
    analysis = '（他没按套路出牌，直接丢下一句话）'
  }

  return { analysis, punchline, vibeTag }
}

function parseItem(raw: string): DestinedItem | null {
  const match = raw.match(/<命运物件>([\s\S]*?)<\/命运物件>/)
  
  // [CTO 防御性补丁] 如果连物品都没有返回，给一个保底默认值，防止下游报错
  if (!match) {
    return {
      id: 'rusty_anchor',
      name: '无名的情绪碎屑',
      desc: '吧台掉落的一句话'
    }
  }

  const content = match[1]
  const idMatch = content.match(/ID:\s*([^\n]+)/)
  const nameMatch = content.match(/NAME:\s*([^\n]+)/)
  const descMatch = content.match(/DESC:\s*([^\n]+)/)
  
  return {
    id: idMatch ? idMatch[1].trim() : 'rusty_anchor',
    name: nameMatch ? nameMatch[1].trim() : '无名的情绪碎屑',
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
  const [vibeTag, setVibeTag] = useState('') 
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
  
  const responseFinishTime = useRef<number>(0) 
  const [isRejected, setIsRejected] = useState(false) 
  
  const [showChildDrawer, setShowChildDrawer] = useState(false)
  const [hasOpenedDrawer, setHasOpenedDrawer] = useState(false)

  // <-- [CTO 注入] 接入 Store
  const { addEntry } = useShelterStore()

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
    setHasOpenedDrawer(localStorage.getItem('hasOpenedChildDrawer') === 'true')
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
  }, [analysis, punchline, actionDone, showRebuttalInput, rebuttalPunchline, isRejected])

  const handleStart = async () => {
    if (!content || loading) return
    
    const limit = await checkLimit()
    const isVip = localStorage.getItem('is_lifetime_vip') === 'true'
    const hasExtra = localStorage.getItem('extra_limit_granted') === '3'

    if (!limit.allowed && !isVip && !hasExtra) {
      alert(`🏪 店长留客通知：\n\n今天你已经来过小店宣泄过了（已达 ${limit.limit} 次上限）。\n避难所灯火再温暖，过去的也不该贪恋。\n\n请先去做那件你一直拖着的事，明天深夜，店长再为你亮灯。`)
      setAnalysis('今天已经来过避难所了。卷帘门已拉下，请回到现实去。')
      setStarted(true)
      setDone(true)
      setTimeout(() => { router.push('/') }, 2000)
      return
    }

    if (!limit.allowed && hasExtra) {
      localStorage.removeItem('extra_limit_granted') 
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

    const memoryContext = getMemoryPromptContext()

    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, emotion, persona, clientHour: new Date().getHours(), memoryContext }),
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
          setVibeTag(parsed.vibeTag) 
          setDestinedItem(parseItem(cleanText))
          break
        } else {
          setRawResponse(buffer)
          const parsed = parseResponse(buffer)
          setAnalysis(parsed.analysis)
          setPunchline(parsed.punchline)
          setVibeTag(parsed.vibeTag) 
          setDestinedItem(parseItem(buffer))
        }
      }
      track('response_done', { persona, emotion })
      responseFinishTime.current = Date.now() 
      setDone(true)
    } catch {
      setAnalysis('出了点问题，请稍后再试。')
      setPunchline('信号不好，店长让你早点休息。') // [CTO 补充] 必须有 punchline 才能激活按钮
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
          clientHour: new Date().getHours() 
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

  // <-- [CTO 核心接管区] 彻底抛弃 localStorage，使用 Store 写入
  const handleFinish = () => {
    if (vibeTag) {
      updateCustomerVibe(vibeTag)
    }

    const startScore = parseInt(emotionScore, 10)
    const generatedReceiptId = 'EH-' + Math.random().toString(36).substring(2, 8).toUpperCase()

    addEntry({
      id: Date.now(),
      timestamp: Date.now(), // 归档用
      emotion,
      content,
      persona,
      rawResponse,
      analysis,
      punchline,
      destinedItem, 
      createdAt: new Date().toISOString(),
      emotionStart: startScore,
      emotionEnd: startScore, 
      status: '待处理',
      receiptId: generatedReceiptId // 👈 补全底层要求必填的核心字段
    })

    sessionStorage.removeItem('entry_content')
    sessionStorage.removeItem('entry_emotion')
    router.push('/done')
  }
  // <-- 核心接管完毕

  const getCustomAction = () => {
    if (persona === 'Ash') {
      return { text: '找个信得过的人出来喝一杯，或者去街边摊狠狠搓一顿，算你的。', sub: '强行打断你当下的脑内死循环，身体动起来，现在就走。' }
    } else if (persona === 'Rin') {
      return { text: '现在立马收车/锁单回家，洗个热水澡，然后钻进被窝睡觉。', sub: '听她的，今晚不跟这个操蛋的世界死磕了。今天不受气了。' }
    } else {
      return { text: `闭上眼，跟记忆里的「${childName}」握个手，或者抱一抱他。`, sub: `告诉他：长大的你没丢脸，你已经把他保护得很好、带得足够远了。` }
    }
  }

  const getTriangleActions = () => {
    if (persona === 'Ash') {
      return { left: '和 Ash 碰一下拳', right: '让 Ash 滚蛋' }
    } else if (persona === 'Rin') {
      return { left: '牵住 Rin 的手', right: '不想看 Rin 一眼' }
    } else {
      return { left: `抱一抱 ${childName}`, right: '让他回家写作业' }
    }
  }

  const actionConfig = getCustomAction()
  const triangleActions = getTriangleActions()
  const currentPersona = PERSONAS.find(p => p.id === persona)
  const displayName = persona === 'Child' ? childName : currentPersona?.name

  const isChild = persona === 'Child'

  const handleDrawerClose = () => {
    setShowChildDrawer(false)
    localStorage.setItem('hasOpenedChildDrawer', 'true')
    setHasOpenedDrawer(true)
  }

  return (
    <>
      {showChildDrawer && <ChildhoodDrawerOverlay onClose={handleDrawerClose} />}

      <div style={{ 
        width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '60px 24px', margin: '0 auto',
        transition: 'all 0.8s ease',
        filter: isChild ? 'sepia(0.35) contrast(1.05) brightness(0.95)' : 'none',
        background: isChild ? '#161410' : 'transparent',
      }}>
        
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

        {punchline && done && !rebuttalDone && (
          <div style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(245,200,66,0.03)', border: '1px solid rgba(245,200,66,0.15)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ color: 'var(--warm-yellow)', fontSize: '11px', letterSpacing: '0.2em' }}>现在，听建议做这件事</p>
            <p style={{ color: 'var(--text-main)', fontSize: '15px', lineHeight: '1.6', fontWeight: '500' }}>{actionConfig.text}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.7 }}>{actionConfig.sub}</p>
            
            {!showRebuttalInput && !actionDone && !isRejected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                <div 
                  onClick={() => {
                    const durationSec = Math.floor((Date.now() - responseFinishTime.current) / 1000)
                    track('needs_deep_venting', { persona, durationSec })
                    setShowRebuttalInput(true)
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '13px', cursor: 'text', opacity: 0.6, transition: 'opacity 0.3s', marginTop: '8px' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                >
                  ...还不爽？骂回去
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px 0' }}>
                  <button
                    onClick={() => { 
                      const durationSec = Math.floor((Date.now() - responseFinishTime.current) / 1000)
                      track('fulfillment_success', { persona, durationSec })
                      setActionDone(true) 
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--warm-yellow)', fontSize: '12px', opacity: 0.6, cursor: 'pointer', transition: 'all 0.3s', padding: '8px 0', letterSpacing: '0.05em' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                  >
                    {triangleActions.left}
                  </button>

                  <button
                    onClick={() => { 
                      const durationSec = Math.floor((Date.now() - responseFinishTime.current) / 1000)
                      track('fulfillment_rejected', { persona, durationSec })
                      setIsRejected(true)
                      setTimeout(() => handleFinish(), 2000) 
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', opacity: 0.3, cursor: 'pointer', transition: 'all 0.3s', padding: '8px 0' }}
                    onMouseEnter={e => {e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.color = '#e87070'}}
                    onMouseLeave={e => {e.currentTarget.style.opacity = '0.3'; e.currentTarget.style.color = 'var(--text-muted)'}}
                  >
                    {triangleActions.right}
                  </button>
                </div>
              </div>
            ) : isRejected ? (
               <div style={{ padding: '24px 0', textAlign: 'center', animation: 'fadeText 0.3s ease-out-forward' }}>
                 <p style={{ color: '#e87070', fontSize: '14px', letterSpacing: '0.2em', opacity: 0.8 }}>已撕毁。</p>
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

        {/* 核心修复：删除伪小票，只保留强动线按钮 */}
        {actionDone && (
          <button 
            onClick={handleFinish} 
            style={{ 
              width: '100%', padding: '16px', borderRadius: '12px', 
              border: '1px dashed rgba(245,200,66,0.6)', 
              background: 'rgba(245,200,66,0.08)', 
              color: 'var(--warm-yellow)', 
              fontSize: '14px', letterSpacing: '0.1em', 
              cursor: 'pointer', animation: 'fadeText 0.3s ease-in',
              fontWeight: 'bold'
            }}
          >
            走向收银台，打出小票
          </button>
        )}

        {actionDone && isChild && (
          <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px', textAlign: 'center', animation: 'fadeText 1s ease-in' }}>
            {hasOpenedDrawer ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.3, fontStyle: 'italic', letterSpacing: '0.1em' }}>
                抽屉里躺着一只再也飞不了的知了。
              </p>
            ) : (
              <button
                onClick={() => setShowChildDrawer(true)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', opacity: 0.2, letterSpacing: '0.1em', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '4px', transition: 'all 0.5s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.2'}
              >
                吧台下面有个卡死的旧抽屉...
              </button>
            )}
          </div>
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
    </>
  )
}