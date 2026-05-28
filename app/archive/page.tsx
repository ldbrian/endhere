'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useShelterStore } from '../store/useShelterStore'

export default function ArchivePage() {
  const router = useRouter()
  const { entries, deleteEntry } = useShelterStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const audio = new Audio('/sounds/rusty-drawer.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {})
    } catch (e) {}
  }, [])

  if (!mounted) return <div style={{ width: '100vw', height: '100vh', background: '#1a1612' }} />

  // 过滤出有效小票
  const archiveEntries = entries.filter(e => e.status !== '已销毁' && e.status !== '彻底消失')

  // 时间引擎计算
  const getDaysOld = (timestamp: number) => {
    if (!timestamp) return 0
    return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
  }

  return (
    <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '40px 20px 80px', margin: '0 auto', minHeight: '100vh' }}>
      
      <div style={{ width: '100%', textAlign: 'left', marginBottom: '10px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 8px 0', letterSpacing: '0.1em' }}>旧抽屉</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, opacity: 0.8, lineHeight: '1.6' }}>
          拉开有些生涩，里面堆着没有烧掉的烂事。<br/>时间久了，字迹会模糊，纸会发脆。
        </p>
      </div>

      {archiveEntries.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)', opacity: 0.3, fontSize: '13px', letterSpacing: '0.2em' }}>
          抽屉是空的。
        </div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {archiveEntries.map((entry, index) => {
            const daysOld = getDaysOld(entry.timestamp)
            const isSealed = entry.isSealed && entry.sealedUntil && Date.now() < entry.sealedUntil
            
            // 物理衰败引擎 (随时间递进)
            const isMildDecay = daysOld >= 3 && daysOld <= 7
            const isSevereDecay = daysOld > 7
            
            // 随机倾斜度，模拟乱丢在抽屉里
            const randomRotation = isSevereDecay ? (index % 2 === 0 ? '-1.5deg' : '1.5deg') : '0deg'

            return (
              <div 
                key={entry.id} 
                style={{ 
                  width: '100%', 
                  padding: '24px', 
                  background: isSealed ? 'rgba(20,20,20,0.8)' : '#fbfaf7', 
                  color: isSealed ? '#555' : '#2a2a2a', 
                  boxShadow: isSevereDecay ? '0 10px 20px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.2)',
                  position: 'relative',
                  // 终极时间滤镜
                  filter: !isSealed && isSevereDecay ? 'sepia(0.6) contrast(0.75) brightness(0.85) grayscale(0.2)' : 
                          !isSealed && isMildDecay ? 'sepia(0.3) contrast(0.9) brightness(0.95)' : 'none',
                  transform: !isSealed ? `rotate(${randomRotation})` : 'none',
                  transition: 'all 0.5s ease',
                  border: isSealed ? '1px dashed #333' : 'none',
                  clipPath: isSealed ? 'none' : 'polygon(0% 0%, 4% 2%, 8% 0%, 12% 2%, 16% 0%, 20% 2%, 24% 0%, 28% 2%, 32% 0%, 36% 2%, 40% 0%, 44% 2%, 48% 0%, 52% 2%, 56% 0%, 60% 2%, 64% 0%, 68% 2%, 72% 0%, 76% 2%, 80% 0%, 84% 2%, 88% 0%, 92% 2%, 96% 0%, 100% 2%, 100% 98%, 96% 100%, 92% 98%, 88% 100%, 84% 98%, 80% 100%, 76% 98%, 72% 100%, 68% 98%, 64% 100%, 60% 98%, 56% 100%, 52% 98%, 48% 100%, 44% 98%, 40% 100%, 36% 98%, 32% 100%, 28% 98%, 24% 100%, 20% 98%, 16% 100%, 12% 98%, 8% 100%, 4% 98%, 0% 100%)'
                }}
              >
                {isSealed && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <div style={{ background: '#d4c5b0', color: '#1a1612', padding: '6px 24px', transform: 'rotate(-10deg)', fontWeight: 'bold', fontSize: '12px', letterSpacing: '0.2em', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                      [ 创可贴止血中 / 暂不可阅 ]
                    </div>
                  </div>
                )}

                <div style={{ opacity: isSealed ? 0.1 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', opacity: 0.6, fontFamily: 'monospace' }}>
                      {entry.receiptId || `EH-OLD-${entry.id.toString().slice(-4)}`}
                    </div>
                    {daysOld > 0 && (
                      <div style={{ fontSize: '10px', color: isSevereDecay ? '#8b6b4a' : '#a67c52', fontStyle: 'italic', letterSpacing: '0.1em' }}>
                        存放 {daysOld} 天 {isSevereDecay ? '| 纸张已发脆' : ''}
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: '14px', lineHeight: '1.7', marginBottom: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: isSevereDecay ? 0.75 : 0.9 }}>
                    {entry.content}
                  </p>

                  <div style={{ width: '100%', height: '1px', borderTop: '1px dashed #8c8273', opacity: 0.3, marginBottom: '16px' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ opacity: 0.5 }}>离店情绪:</span>
                      <span style={{ color: entry.emotionEnd > 7 ? '#d9534f' : entry.emotionEnd < 4 ? '#5cb85c' : '#f0ad4e' }}>
                        {entry.emotionEnd || '?'} / 10
                      </span>
                    </div>

                    {!isSealed && (
                      <button 
                        onClick={() => {
                          if(confirm('真的要彻底烧掉这张旧记录吗？烧掉就彻底没了。')) {
                            deleteEntry(entry.id)
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#d9534f', fontSize: '12px', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', opacity: 0.7 }}
                      >
                        拿去烧毁
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button 
        onClick={() => router.push('/')}
        style={{ marginTop: '32px', width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '14px', letterSpacing: '0.1em', cursor: 'pointer', opacity: 0.8 }}
      >
        关上抽屉，回到吧台
      </button>
    </div>
  )
}