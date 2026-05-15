'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const EMOTION_LABELS: Record<string, string> = {
  regret: '后悔',
  grievance: '委屈',
  unwilling: '不甘',
  irritated: '烦躁',
  sad: '难过',
}

function WriteContent() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const emotion = searchParams.get('emotion') || 'sad'
  const emotionLabel = EMOTION_LABELS[emotion] || '难过'

  const handleSubmit = async () => {
    if (!content.trim() || loading) return
    setLoading(true)
    // 把内容存到sessionStorage，下一页用
    sessionStorage.setItem('entry_content', content)
    sessionStorage.setItem('entry_emotion', emotion)
    router.push('/response')
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '360px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      padding: '60px 24px',
    }}>

      {/* 顶部提示 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.2em' }}>
          END HERE
        </p>
        <p style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: '300', letterSpacing: '0.1em', lineHeight: '1.8' }}>
          你感到<span style={{ color: 'var(--warm-yellow)' }}>「{emotionLabel}」</span>
          <br />
          发生了什么？
        </p>
      </div>

      {/* 输入框 */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写下来，不用整理，不用好看。"
          autoFocus
          rows={10}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            color: 'var(--text-main)',
            fontSize: '15px',
            lineHeight: '1.9',
            letterSpacing: '0.03em',
            fontFamily: 'inherit',
            transition: 'border-color 0.3s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'rgba(245,200,66,0.2)'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border)'
          }}
        />
        {/* 字数 */}
        <p style={{
          position: 'absolute',
          bottom: '12px',
          right: '16px',
          color: 'var(--text-muted)',
          fontSize: '11px',
          opacity: 0.5,
        }}>
          {content.length}
        </p>
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || loading}
        style={{
          width: '100%',
          padding: '15px',
          borderRadius: '12px',
          border: `1px solid ${content.trim() ? 'rgba(245,200,66,0.3)' : 'var(--border)'}`,
          background: content.trim() ? 'rgba(245,200,66,0.08)' : 'transparent',
          color: content.trim() ? 'var(--warm-yellow)' : 'var(--text-muted)',
          fontSize: '14px',
          letterSpacing: '0.2em',
          cursor: content.trim() ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s ease',
          opacity: content.trim() ? 1 : 0.4,
        }}
      >
        {loading ? '正在传递...' : '写完了'}
      </button>

      {/* 返回 */}
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