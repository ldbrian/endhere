'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PERSONAS, PERSONA_PLACEHOLDERS, PERSONA_BUTTONS } from '../lib/personas'
import { track } from '../lib/track'

const EMOTION_LABELS: Record<string, string> = {
  choke: '胸口堵得慌', tear: '眼眶有点热', numb: '整个人木木的', angry: '心里有股无名火', shattered: '感觉快碎掉了'
}

function WriteContent() {
  const [content, setContent] = useState('')
  const [persona, setPersona] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [childName, setChildName] = useState('8岁的自己') 

  const router = useRouter()
  const searchParams = useSearchParams()
  const emotion = searchParams.get('emotion') || 'sad'
  const emotionLabel = EMOTION_LABELS[emotion] || '难过'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('child_nickname')
      if (savedName) setChildName(savedName)
    }
  }, [])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value.trim()
    const finalName = newName === '' ? '8岁的自己' : newName
    setChildName(finalName)
    localStorage.setItem('child_nickname', finalName)
  }

  const selectedPersona = PERSONAS.find(p => p.id === persona)

  const handleSubmit = () => {
    if (!content.trim() || !persona || loading) return
    setLoading(true)
    track('submit_entry', { persona, emotion, content_length: content.length })
    sessionStorage.setItem('entry_content', content)
    sessionStorage.setItem('entry_emotion', emotion)
    localStorage.setItem('preferred_persona', persona)
    
    // === 核心拦截：如果选的是店长，不找AI，直接打小票进结算页 ===
    if (persona === 'Manager') {
      const initialScore = parseInt(sessionStorage.getItem('emotion_score') || '7', 10)
      const mockEntry = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        emotionStart: initialScore,
        emotionEnd: initialScore,
        emotion: emotion,
        status: '未投递', // 👈 核心修复：一开始只能是未投递草稿
        persona: 'Manager',
        content: content,
        rawResponse: '【系统提示】：你选择了直接留言给店长，没有触发人工智能。',
        released: false
      }
      
      const existing = JSON.parse(localStorage.getItem('entries') || '[]')
      // 将新记录插到最前面
      localStorage.setItem('entries', JSON.stringify([mockEntry, ...existing])) 
      
      router.push('/done')
      return
    }

    // 如果选的是其他人，正常去找大模型聊天
    router.push('/response')
  }

  const getPlaceholder = () => {
    if (!persona) return ''
    return PERSONA_PLACEHOLDERS[persona]?.replace('{name}', childName) || ''
  }

  const getButtonText = () => {
    if (!persona) return ''
    if (persona === 'Child') {
      return childName === '8岁的自己' ? '交给 8岁的自己' : `穿越回去，交给 ${childName}`
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
          你想跟谁说？
        </p>
        
        {/* --- 上层：3个 AI 店员 (横向并排) --- */}
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
                    {p.id === 'Child' && childName !== '8岁的自己' ? childName : p.name}
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
                      ⏳ 记忆唤醒
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', opacity: 0.6 }}>{p.sub}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* --- 下层：活人店长专属通道 (横向满宽、虚线物理感) --- */}
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
                    📝 {p.name}
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    {p.sub}
                  </span>
                </div>
                <span style={{ fontSize: '11px', opacity: isSelected ? 1 : 0.4, border: `1px solid ${isSelected ? p.color : 'var(--text-muted)'}`, padding: '4px 8px', borderRadius: '6px' }}>
                  专属通道
                </span>
              </button>
            </div>
          )
        })}

        {/* 改名抽屉 */}
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
              ✉️ 小时候，奶奶怎么叫你？
            </span>
            <input 
              type="text"
              placeholder="点此输入你的乳名"
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

      {/* 第二步：输入框 */}
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
            {loading ? '正在传递...' : getButtonText()}
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
          ← 返回
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