'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { track } from '../lib/track'
import { useShelterStore } from '../store/useShelterStore' // 接入全局 Store

function DestroyContent() {
  const { entries, updateEntry } = useShelterStore()
  const entry = entries[0] // 响应式绑定最新的一条小票
  
  const [destroyState, setDestroyState] = useState<'choosing' | 'crushing' | 'burning' | 'destroyed'>('choosing')
  const [usedStrangerMatch, setUsedStrangerMatch] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isStrangerMatch = searchParams.get('strangerMatch') === 'true'

  useEffect(() => {
    // 防御性路由：如果没有小票，直接踢回主页
    if (!entry) {
      router.push('/')
    }
  }, [entry, router])

  useEffect(() => {
    // 陌生人火柴自动焚毁逻辑
    if (isStrangerMatch && entry && destroyState === 'choosing') {
      setUsedStrangerMatch(true)
      setDestroyState('burning')
      setTimeout(() => {
        executeDeleteFromDB()
        setDestroyState('destroyed')
      }, 3500)
    }
  }, [isStrangerMatch, entry, destroyState])

  const handleCrush = () => {
    setDestroyState('crushing')
    track('destroy_crush', { receipt_id: entry?.receiptId })
    setTimeout(() => { executeDeleteFromDB(); setDestroyState('destroyed') }, 1500)
  }

  const handleBurn = () => {
    setDestroyState('burning')
    track('destroy_burn', { receipt_id: entry?.receiptId })
    setTimeout(() => { executeDeleteFromDB(); setDestroyState('destroyed') }, 3500)
  }

  const executeDeleteFromDB = () => {
    if (entry) {
      // 绝对安全的状态更新，告别 JSON.parse
      updateEntry(entry.id, {
        content: '一团模糊的灰烬',
        rawResponse: '',
        analysis: '',
        punchline: '',
        status: '彻底消失',
        released: true
      })
    }
  }

  if (!entry) return null

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', padding: '50px 20px', margin: '0 auto' }}>
      
      {usedStrangerMatch && destroyState === 'burning' && (
        <div style={{ color: '#e87070', fontSize: '13px', letterSpacing: '0.1em', animation: 'fadeIn 0.5s ease', textAlign: 'center' }}>
          借用陌生人的火柴<br/>火光很暖
        </div>
      )}

      <div className={`receipt-paper ${destroyState === 'crushing' ? 'crushing-anim' : ''} ${destroyState === 'burning' ? 'burning-anim' : ''}`}
        style={{ width: '100%', display: destroyState === 'destroyed' ? 'none' : 'flex', flexDirection: 'column', gap: '24px', padding: '36px 24px 40px', background: '#fbfaf7', color: '#2a2a2a', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative', fontFamily: 'monospace, "PingFang SC"', transition: 'all 0.5s ease', clipPath: 'polygon(0% 0%, 4% 2%, 8% 0%, 12% 2%, 16% 0%, 20% 2%, 24% 0%, 28% 2%, 32% 0%, 36% 2%, 40% 0%, 44% 2%, 48% 0%, 52% 2%, 56% 0%, 60% 2%, 64% 0%, 68% 2%, 72% 0%, 76% 2%, 80% 0%, 84% 2%, 88% 0%, 92% 2%, 96% 0%, 100% 2%, 100% 98%, 96% 100%, 92% 98%, 88% 100%, 84% 98%, 80% 100%, 76% 98%, 72% 100%, 68% 98%, 64% 100%, 60% 98%, 56% 100%, 52% 98%, 48% 100%, 44% 98%, 40% 100%, 36% 98%, 32% 100%, 28% 98%, 24% 100%, 20% 98%, 16% 100%, 12% 98%, 8% 100%, 4% 98%, 0% 100%)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: 0.7 }}>
          <p style={{ fontSize: '9px', letterSpacing: '3px', margin: 0 }}>*{entry.receiptId || entry.id}*</p>
        </div>
        <div style={{ width: '100%', height: '1px', borderTop: '1px dashed #8c8273', opacity: 0.3 }} />
        
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#1a1612', textAlign: 'center' }}>等待销毁的记录</h2>
        <p style={{ fontSize: '13px', lineHeight: '1.6', opacity: 0.8 }}>{entry.content.length > 50 ? entry.content.slice(0, 50) + '...' : entry.content}</p>
      </div>

      {destroyState === 'choosing' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.3s ease' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', marginBottom: '8px', letterSpacing: '0.1em' }}>该如何处理它？(动作不可逆)</p>
          <button onClick={handleCrush} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>物理揉碎</span><span style={{ fontSize: '11px', opacity: 0.5 }}>安静地丢弃</span>
          </button>
          <button onClick={handleBurn} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px dashed #e87070', background: 'rgba(232,112,112,0.05)', color: '#e87070', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>划根火柴烧掉</span>
          </button>
          
          <button onClick={() => router.push('/archive')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', marginTop: '12px', opacity: 0.5, cursor: 'pointer' }}>还是算了吧，放进抽屉</button>
        </div>
      )}

      {destroyState === 'destroyed' && (
        <div style={{ width: '100%', textAlign: 'center', animation: 'fadeIn 1s ease', marginTop: '40px' }}>
          <div style={{ fontSize: '48px', opacity: 0.4, marginBottom: '20px' }}>💨</div>
          <p style={{ color: 'var(--text-main)', fontSize: '16px', letterSpacing: '0.2em', marginBottom: '8px' }}>风一吹，什么都没了。</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6, marginBottom: '40px' }}>你该往前走了。</p>
          <button onClick={() => router.push('/archive')} style={{ padding: '12px 32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em', cursor: 'pointer' }}>去抽屉看一眼</button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .crushing-anim { animation: crushPaper 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        @keyframes crushPaper { 0% { transform: scale(1) rotate(0deg); opacity: 1; } 40% { transform: scale(0.9) rotate(2deg) skew(2deg, 2deg); filter: grayscale(50%); } 100% { transform: scale(0.1) rotate(45deg); opacity: 0; filter: blur(5px); } }
        .burning-anim { animation: burnPaper 3.5s ease-in forwards; }
        @keyframes burnPaper { 0% { filter: brightness(1) sepia(0); opacity: 1; transform: translateY(0); } 30% { filter: brightness(0.6) sepia(0.8) hue-rotate(-20deg) saturate(3); opacity: 0.9; } 60% { filter: brightness(0.2) sepia(1) hue-rotate(-50deg) saturate(5); opacity: 0.7; transform: translateY(-10px); } 100% { filter: brightness(0) opacity(0); transform: translateY(-50px) scale(0.8); opacity: 0; } }
      `}</style>
    </div>
  )
}

export default function DestroyPage() {
  return <Suspense><DestroyContent /></Suspense>
}