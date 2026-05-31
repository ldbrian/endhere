'use client'
import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PERSONAS, PERSONA_PLACEHOLDERS, PERSONA_BUTTONS } from '../lib/personas'
import { track } from '../lib/track'
import { useShelterStore } from '../store/useShelterStore' // 接入全局 Store
import { trackSpaceEvent } from '../lib/telemetry'

const EMOTION_LABELS: Record<string, string> = {
  choke: '有点难受', tear: '想哭', numb: '麻木', angry: '愤怒', shattered: '崩溃'
}

function WriteContent() {
  const [content, setContent] = useState('')
  const [persona, setPersona] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [childName, setChildName] = useState('8岁')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const emotion = searchParams.get('emotion') || 'sad'
  const emotionLabel = EMOTION_LABELS[emotion] || '复杂'

  // 引入全局添加方法
  const { addEntry } = useShelterStore()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('child_nickname')
      if (savedName) setChildName(savedName)
    }
  }, [])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value.trim()
    const finalName = newName === '' ? '8岁' : newName
    setChildName(finalName)
    localStorage.setItem('child_nickname', finalName)
  }

  const selectedPersona = PERSONAS.find(p => p.id === persona)

  const handleSubmit = () => {
    if (!content.trim() || !persona || loading) return
    setLoading(true)
    track('submit_entry', { persona, emotion, content_length: content.length })
    
    // 跨页面传参暂存（不涉及核心列表数据，保留 sessionStorage 无妨）
    sessionStorage.setItem('entry_content', content)
    sessionStorage.setItem('entry_emotion', emotion)
    localStorage.setItem('preferred_persona', persona)
    
    // === 店长模式直通车 & CLI 控制台 ===
    if (persona === 'Manager') {
      const isCommand = content.trim().startsWith('/')
      
      // 如果是系统指令，直接拦截发送，不生成小票
      if (isCommand) {
        fetch('/api/mailbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptId: `CLI-${Date.now()}`, userMessage: content, aiResponse: 'CLI_EXEC' })
        }).then(async (res) => {
          const data = await res.json()
          alert(data.message) // 极简反馈，告诉你指令是否成功
          setContent('') // 清空输入框
          setLoading(false)
        }).catch(() => {
          alert('指令发送失败，检查网络')
          setLoading(false)
        })
        return 
      }

      // 如果不是指令，走原本的店长普通留言逻辑
      const initialScore = parseInt(sessionStorage.getItem('emotion_score') || '7', 10)
      const mockEntry = {
        id: Date.now(),
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        emotionStart: initialScore,
        emotionEnd: initialScore,
        emotion: emotion,
        status: '待处理',
        persona: 'Manager',
        content: content,
        rawResponse: '意见已投递，等待店长查看',
        released: false
      }
      
      addEntry(mockEntry)
      router.push('/done')
      return
    }

    // 正常流转到 AI 响应页
    router.push('/response')
  }

  const getPlaceholder = () => {
    if (!persona) return ''
    return PERSONA_PLACEHOLDERS[persona]?.replace('{name}', childName) || ''
  }

  const getButtonText = () => {
    if (!persona) return ''
    if (persona === 'Child') {
      return childName === '8岁' ? '写给 8岁的自己' : `写给 ${childName}`
    }
    return PERSONA_BUTTONS[persona] || ''
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
      margin: '0 auto',
    }}>
      {/* 头部标题区 */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '8px',
        opacity: focused ? 0.3 : 1,
        transition: 'opacity 0.4s ease',
      }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>
          END HERE 避难所
        </p>
        <p style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: '300', letterSpacing: '0.1em', lineHeight: '1.8' }}>
          带着 <span style={{ color: 'var(--warm-yellow)' }}> {emotionLabel} </span> 的情绪，<br/>今晚想把烂事留给谁？
        </p>
      </div>

      {/* 倾听者选择区 */}
      <div style={{
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        transition: 'all 0.4s ease',
      }}>
        <p style={{ 
          color: 'var(--text-muted)', 
          fontSize: '12px', 
          letterSpacing: '0.15em',
          opacity: focused ? 0.3 : 1,
          transition: 'opacity 0.4s ease',
        }}>
          选择倾听者
        </p>
        
        {/* --- 常规 AI 选项 (横向排列) --- */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {PERSONAS.filter(p => p.id !== 'Manager').map(p => {
            const isSelected = persona === p.id;
            return (
              <div key={p.id} style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                opacity: focused ? (isSelected ? 1 : 0.15) : 1,
                transition: 'opacity 0.4s ease',
              }}>
                <button
                  onClick={() => setPersona(p.id)}
                  style={{
                    width: '100%', padding: '14px 4px', borderRadius: '12px',
                    border: `1px solid ${isSelected ? p.color : 'var(--border)'}`,
                    background: isSelected ? `${p.color}15` : 'transparent',
                    color: isSelected ? p.color : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.25s ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    {p.id === 'Child' && childName !== '8岁' ? childName : p.name}
                  </span>
                  
                  {p.id === 'Child' ? (
                    <span style={{ 
                      fontSize: '9px', color: 'var(--warm-yellow)', 
                      border: '1px solid rgba(245,200,66,0.25)', 
                      background: 'rgba(245,200,66,0.06)',
                      padding: '2px 5px', borderRadius: '4px', marginTop: '2px',
                      animation: 'pulse 2s infinite',
                      whiteSpace: 'nowrap'
                    }}>
                      可自定义
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', opacity: 0.6 }}>{p.sub}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* --- 店长模式选项 (单独成行) --- */}
        {PERSONAS.filter(p => p.id === 'Manager').map(p => {
          const isSelected = persona === p.id;
          return (
            <div key={p.id} style={{ 
              width: '100%',
              opacity: focused ? (isSelected ? 1 : 0.15) : 1,
              transition: 'opacity 0.4s ease',
            }}>
              <button
                onClick={() => setPersona(p.id)}
                style={{
                  width: '100%', padding: '16px 20px', borderRadius: '12px',
                  border: `1px dashed ${isSelected ? p.color : 'var(--border)'}`, 
                  background: isSelected ? `${p.color}15` : 'rgba(255,255,255,0.01)',
                  color: isSelected ? p.color : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.25s ease',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: isSelected ? p.color : 'var(--text-main)' }}>
                      {p.name}
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    {p.sub}
                  </span>
                </div>
                <span style={{ fontSize: '11px', opacity: isSelected ? 1 : 0.4, border: `1px solid ${isSelected ? p.color : 'var(--text-muted)'}`, padding: '4px 8px', borderRadius: '6px' }}>
                  不经过 AI
                </span>
              </button>
            </div>
          )
        })}

        {/* 动态输入框：Child 称呼 */}
        <div style={{ 
          width: '100%',
          maxHeight: persona === 'Child' ? '80px' : '0px',
          opacity: persona === 'Child' ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: persona === 'Child' ? '4px 2px' : '0px 2px',
        }}>
          <div style={{ 
            display: 'flex', 
            background: 'rgba(245,200,66,0.03)', 
            border: '1px dashed rgba(245,200,66,0.2)', 
            borderRadius: '8px',
            padding: '10px 14px',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 0 12px rgba(245,200,66,0.02)',
          }}>
            <span style={{ color: 'var(--warm-yellow)', fontSize: '11px', whiteSpace: 'nowrap', opacity: 0.8 }}>
              他/她的名字是：
            </span>
            <input 
              type="text" 
              placeholder="例如：小明，或者 18岁的自己" 
              maxLength={6}
              onChange={handleNameChange}
              style={{ 
                background: 'transparent', border: 'none', 
                borderBottom: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-main)', fontSize: '12px', 
                width: '100%', padding: '2px 0', outline: 'none',
                fontFamily: 'inherit', letterSpacing: '0.05em'
              }}
            />
          </div>
        </div>
      </div>

      {/* 文本输入与提交区 */}
      {persona && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.3s ease-out forwards' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={getPlaceholder()} 
              autoFocus
              rows={9}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                width: '100%',
                background: focused ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${focused ? (selectedPersona?.color + '50') : 'var(--border)'}`,
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
              color: 'var(--text-muted)', fontSize: '11px', opacity: 0.3,
            }}>
              {content.length}
            </p>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            style={{
              width: '100%', padding: '18px', borderRadius: '12px',
              border: `1px solid ${content.trim() ? (selectedPersona?.color + '60') : 'var(--border)'}`,
              background: content.trim() ? `${selectedPersona?.color}12` : 'transparent',
              color: content.trim() ? selectedPersona?.color : 'var(--text-muted)',
              fontSize: '15px', letterSpacing: '0.15em', fontWeight: content.trim() ? '600' : '400',
              cursor: content.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              opacity: content.trim() ? 1 : 0.3,
            }}
          >
            {loading ? '写字中...' : getButtonText()}
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
            alignSelf: 'center', marginTop: '8px'
          }}
        >
          返回吧台
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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