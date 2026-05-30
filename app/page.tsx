'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { track } from './lib/track'
import PlasticBag from './components/PlasticBag'
import { recordCustomerAction } from './lib/memory'
import { createClient } from '@supabase/supabase-js'
import { useTraces } from './hooks/useTraces'
import { useEntityStore } from './store/useEntityStore' // <--- 引入 V1.4 实体状态

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EMOTIONS = [
  { id: 'choke', label: '胸口堵得慌' },
  { id: 'tear', label: '眼眶有点热' },
  { id: 'numb', label: '整个人木木的' },
  { id: 'angry', label: '心里有无名火' },
  { id: 'shattered', label: '感觉快碎了' },
]

// 倒霉小票池（5% 随机）
const MISHAPS = [
  '泡面没调料包',
  '钥匙掉水沟里了',
  '踩到口香糖',
  '伞被风吹翻',
  '手机摔出一条裂痕',
  '店员跑车被贴条了',
]

export default function Home() {
  const [selected, setSelected] = useState<string | null>(null)
  const [score] = useState(7)
  const [showEmotions, setShowEmotions] = useState(false)

  const [ashMumble, setAshMumble] = useState<string | null>(null)
  const [rinMumble, setRinMumble] = useState<string | null>(null)
  
  const [activeEvent, setActiveEvent] = useState<'clear' | 'rain' | 'broken_bulb'>('clear')
  const [timeStateStr, setTimeStateStr] = useState<string>('...')
  const [hasBasketItems, setHasBasketItems] = useState(false)

  const [clockTime, setClockTime] = useState({ h: '--', m: '--' })
  const [randOffsets, setRandOffsets] = useState({ paper: 1, board: -1, receipt: 8, basket: -1 })

  const [ashStatus, setAshStatus] = useState('理货中')
  const [rinStatus, setRinStatus] = useState('打盹中')
  const [mishap, setMishap] = useState<string | null>(null)

  const router = useRouter()

  // ================= 物理痕迹引擎 =================
  const { getTraceStatus } = useTraces()

  const stoolTrace = getTraceStatus('broken_stool', {
    hot: '凳面还有一点余温...',
    warm: '旁边有半杯没喝完的凉水...',
    cold: ''
  })

  const windowTrace = getTraceStatus('window_seat', {
    hot: '玻璃上有一团刚哈出的雾气...',
    warm: '窗台上留着半圈浅浅的水印...',
    cold: ''
  })

  const bookshelfTrace = getTraceStatus('bookshelf', {
    hot: '有本书还没插回原位...',
    warm: '书架上有一层被抹掉的浮灰...',
    cold: ''
  })

  // ================= 实体坐标系引擎 V1.4 =================
  const stoolLocation = useEntityStore(state => state.stoolLocation)
  const moveStool = useEntityStore(state => state.moveStool)

  // ================= 生命钩子 =================
  useEffect(() => {
    const enterTime = Date.now()
    return () => {
      const stayDuration = Math.round((Date.now() - enterTime) / 1000)
      track('stay_duration', { page: 'home', duration_seconds: stayDuration })
    }
  }, [])

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem('mishap_shown')
    if (!alreadyShown && Math.random() < 0.05) {
      const randomMishap = MISHAPS[Math.floor(Math.random() * MISHAPS.length)]
      setMishap(randomMishap)
      sessionStorage.setItem('mishap_shown', 'true')
      setTimeout(() => setMishap(null), 10000)
    }
  }, [])

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setClockTime({
        h: String(now.getHours()).padStart(2, '0'),
        m: String(now.getMinutes()).padStart(2, '0')
      })
    }
    updateClock()
    const clockInterval = setInterval(updateClock, 1000)
    return () => clearInterval(clockInterval)
  }, [])

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 0 && hour < 5) setTimeStateStr('凌晨了，街上没人...')
    else if (hour >= 5 && hour < 8) setTimeStateStr('天快亮了...')
    else if (hour >= 8 && hour < 18) setTimeStateStr('白天，外面有点吵...')
    else if (hour >= 18 && hour < 20) setTimeStateStr('太阳下山了...')
    else setTimeStateStr('今晚夜色很沉...')

    const ashQuotes = ['啧...', '这破账本...', '（点烟声）', '怎么又停电了...', '门别关', '随便坐']
    const rinQuotes = ['（翻书声）', '有点困...', '雨还不停...', '（擦杯子）', '...嗯？', '今晚外面挺吵吧', '不写东西也没关系']

    const triggerMumble = (setMumble: any, quotes: string[]) => {
      if (Math.random() > 0.45) {
        setMumble(quotes[Math.floor(Math.random() * quotes.length)])
        setTimeout(() => setMumble(null), 4000)
      }
    }

    const mumbleInterval = setInterval(() => {
      if (Math.random() > 0.5) triggerMumble(setAshMumble, ashQuotes)
      else triggerMumble(setRinMumble, rinQuotes)
    }, 9000)

    return () => clearInterval(mumbleInterval)
  }, [])

  useEffect(() => {
    recordCustomerAction('visit')
    const fetchState = async () => {
      try {
        const { data: envData } = await supabase.from('world_state').select('event_type').eq('id', true).single()
        if (envData) setActiveEvent(envData.event_type as any)
        
        const { data: basketData } = await supabase.from('iron_basket').select('created_at').eq('status', 'available')
        if (basketData) {
          const now = Date.now()
          const hasValid = basketData.some(item => (now - new Date(item.created_at).getTime()) <= 24 * 60 * 60 * 1000)
          setHasBasketItems(hasValid)
        }
      } catch (e) {}
    }
    fetchState()
    const interval = setInterval(fetchState, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleEnter = (e: React.MouseEvent) => {
    e.stopPropagation()
    const finalEmotion = selected || 'numb'
    track('enter_write', { emotion: finalEmotion, score })
    sessionStorage.setItem('emotion_score', String(score))
    router.push(`/write?emotion=${finalEmotion}`)
  }

  const ashIsMissing = ashStatus === '后巷抽烟' || ashStatus === '不知道去哪了'

  const printBlankReceipt = () => {
    alert('「你什么也没说。店也不知道你在想什么。这样也行。」')
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #13110f; }
        .root-container {
          background: #141210; width: 100%; max-width: 860px; margin: 0 auto;
          min-height: 100dvh; position: relative; overflow-x: hidden;
          font-family: 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
          box-shadow: 0 0 120px rgba(0,0,0,0.9), 0 0 10px rgba(245,200,66,0.03);
        }
        .floor { display: grid; grid-template-columns: 2fr 1fr; gap: 0; position: relative; }
        @media (max-width: 768px) {
          .floor { grid-template-columns: 1fr; }
          .zone-construction { min-height: 60dvh !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.03) !important; }
          .zone-counter { min-height: 40dvh !important; border-left: none !important; border-top: none !important; padding-top: 30px !important; }
        }
        @keyframes flicker { 0%,89%,100%{opacity:1} 90%{opacity:.7} 92%{opacity:.9} 94%{opacity:.75} 96%{opacity:1} }
        @keyframes pulseDot { 0%,100%{opacity:.15} 50%{opacity:.6} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fanSpin { 100% {transform: rotate(360deg)} }
        @keyframes blinkClock { 0%, 100% { opacity: 1; } 50% { opacity: 0.1; } }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-5px); }
          10% { opacity: 1; transform: translateX(0); }
          90% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(5px); }
        }
      `}</style>

      <div className="root-container flex flex-col">
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.04) 3px,rgba(0,0,0,0.04) 4px)', pointerEvents: 'none', zIndex: 50 }}></div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 20%, rgba(245,200,66,0.04), transparent 35%)', pointerEvents: 'none', zIndex: 2, opacity: 0.7 }}></div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 24px 16px', position: 'relative', zIndex: 10 }}>
          <div>
            <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', opacity: 0.92 }}>
              <img src="/logo.png" alt="End Here" style={{ width: '26px', height: '26px', filter: 'grayscale(100%) sepia(100%) hue-rotate(5deg) brightness(1.5) contrast(1.2)' }} />
              <span style={{ color: '#e8e0d5', fontSize: '15px', letterSpacing: '.22em', fontWeight: 400 }}>END HERE</span>
              <span style={{ color: '#9a8f85', fontSize: '10px', letterSpacing: '.1em', opacity: 0.5 }}>便利店</span>
            </div>
            <p style={{ color: '#9a8f85', fontSize: '9px', letterSpacing: '.15em', opacity: 0.4, marginTop: '8px', paddingLeft: '36px' }}>门没锁 · 随便待会儿</p>
          </div>
          <div style={{ pointerEvents: 'auto', zIndex: 60, transform: 'rotate(2deg)', opacity: 0.9 }}>
            <PlasticBag />
          </div>
        </div>

        <div className="floor flex-1" style={{ position: 'relative', zIndex: 1 }}>

          {/* ─── 左/上: 施工区 ─── */}
          <div className="zone-construction" style={{ position: 'relative', borderRight: '1px solid rgba(255,255,255,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ position: 'absolute', top: '-15%', left: '25%', width: '150%', height: '80%', background: 'conic-gradient(from 0deg, rgba(0,0,0,0.8) 0deg, transparent 40deg, rgba(0,0,0,0.8) 120deg, transparent 160deg, rgba(0,0,0,0.8) 240deg, transparent 280deg)', opacity: 0.08, animation: 'fanSpin 16s linear infinite', pointerEvents: 'none', zIndex: 1 }}></div>
            <div style={{ position: 'absolute', bottom: '3%', left: '8%', opacity: 0.08, zIndex: 5, pointerEvents: 'none' }}>
              <svg width="35" height="18" viewBox="0 0 40 20" fill="currentColor" color="#e8e0d5">
                <path d="M10 20 C5 20, 0 15, 0 10 C0 5, 10 5, 15 10 C20 15, 30 15, 35 10 C38 7, 40 10, 40 15 C40 20, 20 20, 10 20 Z" />
                <path d="M30 12 L32 5 L35 10 Z" />
                <path d="M35 10 L38 5 L40 12 Z" />
              </svg>
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '3fr 4.5fr 2.5fr', gridTemplateRows: '2fr 1fr', gap: '8px', padding: '24px', opacity: 0.75, pointerEvents: 'none', zIndex: 2 }}>
              
              {/* [左上] 冰柜位 */}
              <div style={{ border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'repeating-linear-gradient(45deg, #f5c842, #f5c842 4px, transparent 4px, transparent 8px)', opacity: 0.4 }}></div>
                <span style={{ color: '#a89f91', fontSize: '11px', writingMode: 'vertical-lr', letterSpacing: '0.4em' }}>[ 冰柜区 ]</span>
              </div>

              {/* [中上] 货架区 */}
              <div style={{ border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'repeating-linear-gradient(45deg, #f5c842, #f5c842 4px, transparent 4px, transparent 8px)', opacity: 0.4 }}></div>
                <span style={{ color: '#a89f91', fontSize: '12px', letterSpacing: '0.3em' }}>货架占位</span>
                <div style={{ width: '70%', height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
                <div style={{ width: '70%', height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
              </div>

              {/* [右上] LED 电子时钟 */}
              <div style={{ border: '1px dashed rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '12px' }}>
                <div style={{ background: 'rgba(15,8,0,0.85)', border: '1px solid rgba(255,70,0,0.15)', padding: '4px 6px', borderRadius: '2px', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.9), 0 0 4px rgba(255,70,0,0.1)', display: 'flex', alignItems: 'center' }}>
                   <span style={{ fontFamily: 'monospace', color: '#f24822', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.1em', textShadow: '0 0 5px rgba(242,72,34,0.6)' }}>
                     {clockTime.h}<span style={{ animation: 'blinkClock 2s infinite' }}>:</span>{clockTime.m}
                   </span>
                </div>
              </div>

              {/* [左下] 角落物理区 (实体坐标系 V1.4) */}
              <div 
                style={{ 
                  border: '1px dashed rgba(255,255,255,0.06)', 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                  padding: '10px', transition: 'all 0.4s ease', pointerEvents: 'auto',
                  gap: '6px', position: 'relative'
                }}
              >
                {/* 状态 1：凳子在角落 */}
                <div 
                  style={{ 
                    opacity: stoolLocation === 'corner' ? 1 : 0,
                    pointerEvents: stoolLocation === 'corner' ? 'auto' : 'none',
                    position: stoolLocation === 'corner' ? 'relative' : 'absolute',
                    transition: 'opacity 1s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
                  }}
                >
                  <div 
                    onClick={() => router.push('/sit')}
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'opacity 0.2s' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.opacity = '1'}
                  >
                    <div style={{ width: '18px', height: '14px', borderTop: '2.5px solid rgba(168,159,145,0.4)', borderLeft: '2px solid rgba(168,159,145,0.15)', borderRight: '2px solid rgba(168,159,145,0.15)' }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ color: '#a89f91', fontSize: '9px', opacity: 0.6, letterSpacing: '0.2em' }}>[ 破木凳 ]</span>
                      <span style={{ color: '#d4cdb3', fontSize: '8px', opacity: stoolTrace ? 0.8 : 0, letterSpacing: '0.1em', transition: 'opacity 1.5s ease', textAlign: 'center', minHeight: '12px' }}>
                        {stoolTrace}
                      </span>
                    </div>
                  </div>
                  {/* 位移交互动作 */}
                  <span 
                    onClick={(e) => { e.stopPropagation(); moveStool('bar'); }}
                    style={{ color: '#8f857a', fontSize: '8px', cursor: 'pointer', textDecoration: 'underline dotted', marginTop: '4px', transition: 'color 0.2s' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLSpanElement>) => e.currentTarget.style.color = '#d4cdb3'}
                    onMouseLeave={(e: React.MouseEvent<HTMLSpanElement>) => e.currentTarget.style.color = '#8f857a'}
                  >
                    {'>'} 拖到吧台去
                  </span>
                </div>

                {/* 状态 2：凳子被拖走后的空荡痕迹 */}
                <div 
                  style={{ 
                    opacity: stoolLocation === 'bar' ? 0.6 : 0,
                    pointerEvents: stoolLocation === 'bar' ? 'auto' : 'none',
                    position: stoolLocation === 'bar' ? 'relative' : 'absolute',
                    transition: 'opacity 1s ease', textAlign: 'center'
                  }}
                >
                  <span style={{ color: '#6a5e52', fontSize: '9px', letterSpacing: '0.1em', fontStyle: 'italic' }}>
                    [ 角落空荡荡的，<br/>地砖上有划痕 ]
                  </span>
                </div>
              </div>

              {/* [中下] 窗台 */}
              <div style={{ border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'repeating-linear-gradient(45deg, #f5c842, #f5c842 4px, transparent 4px, transparent 8px)', opacity: 0.4 }}></div>
                <span style={{ color: '#a89f91', fontSize: '10px', letterSpacing: '0.2em', zIndex: 5 }}>[ 靠窗空位 ]</span>
                <span style={{ color: '#d4cdb3', fontSize: '8px', opacity: windowTrace ? 0.8 : 0, letterSpacing: '0.1em', transition: 'opacity 1.5s ease', textAlign: 'center', minHeight: '12px', zIndex: 5 }}>
                  {windowTrace}
                </span>
              </div>

              {/* [右下] 书架 */}
              <div style={{ border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'repeating-linear-gradient(45deg, #f5c842, #f5c842 4px, transparent 4px, transparent 8px)', opacity: 0.4 }}></div>
                <span style={{ color: '#a89f91', fontSize: '10px', letterSpacing: '0.2em', zIndex: 5 }}>[ 旧书架 ]</span>
                <span style={{ color: '#d4cdb3', fontSize: '8px', opacity: bookshelfTrace ? 0.8 : 0, letterSpacing: '0.1em', transition: 'opacity 1.5s ease', textAlign: 'center', minHeight: '12px', zIndex: 5 }}>
                  {bookshelfTrace}
                </span>
              </div>

            </div>

            <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,12,10,0.25)', zIndex: 3, pointerEvents: 'none' }}></div>

            <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%) rotate(-4deg)', zIndex: 10, width: 'max-content', pointerEvents: 'none' }}>
              <div style={{ padding: '12px 20px', background: 'rgba(15,12,9,0.95)', border: '1px solid rgba(245,200,66,0.4)', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(245,200,66,0.04) 5px,rgba(245,200,66,0.04) 10px)' }}></div>
                <div style={{ position: 'absolute', top: '-6px', left: '10%', width: '40px', height: '12px', background: 'rgba(245,200,66,0.4)', transform: 'rotate(6deg)' }}></div>
                <div style={{ position: 'relative', textAlign: 'center' }}>
                  <div style={{ color: 'rgba(245,200,66,0.8)', fontSize: '11px', letterSpacing: '.2em', fontFamily: 'monospace', margin: '0 0 4px 0' }}>⚠ 施工中</div>
                  <div style={{ color: 'rgba(245,200,66,0.5)', fontSize: '9px', letterSpacing: '.1em', fontFamily: 'monospace' }}>内部区域尚未开放</div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── 右侧收银区 ─── */}
          <div className="zone-counter" style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '0 0 20px 0' }}>
            
            {mishap && (
              <div style={{ background: 'rgba(30,20,15,0.95)', border: '1px solid #a5673f', padding: '6px 10px', fontSize: '9px', color: '#cf9f7a', margin: '8px 20px', textAlign: 'center', animation: 'fadeInOut 10s forwards', position: 'relative', zIndex: 15 }}>
                [ 店员倒霉小票 ] {mishap}
              </div>
            )}

            <div style={{ padding: '0 20px', marginBottom: '16px', zIndex: 10 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#9a8f85', opacity: 0.4, animation: 'pulseDot 2s infinite', display: 'inline-block' }}></span>
                <span style={{ color: '#9a8f85', fontSize: '10px', letterSpacing: '.1em', opacity: 0.5 }}>
                  {activeEvent === 'rain' ? '外面还在下雨...' : activeEvent === 'broken_bulb' ? '有颗灯泡在闪...' : timeStateStr}
                </span>
              </div>
            </div>

            <div style={{ padding: '4px 20px 12px', zIndex: 10 }}>
              <h2 style={{ color: '#8f857a', fontSize: '13px', letterSpacing: '0.25em', fontFamily: 'serif', opacity: 0.5, margin: 0 }}>收银台</h2>
            </div>

            {/* 吧台物理区追加渲染 (实体坐标系 V1.4) */}
            <div 
              style={{
                padding: '0 20px',
                height: stoolLocation === 'bar' ? 'auto' : '0px',
                opacity: stoolLocation === 'bar' ? 1 : 0,
                overflow: 'hidden',
                transition: 'opacity 1s ease, height 0.5s ease',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: stoolLocation === 'bar' ? '12px' : '0'
              }}
            >
              <span style={{ color: '#a89f91', fontSize: '10px', letterSpacing: '0.1em', opacity: 0.8 }}>
                [ 一把破木凳放在吧台前 ]
              </span>
              <span 
                onClick={() => moveStool('corner')}
                style={{ color: '#8f857a', fontSize: '9px', cursor: 'pointer', textDecoration: 'underline dotted', transition: 'color 0.2s' }}
                onMouseEnter={(e: React.MouseEvent<HTMLSpanElement>) => e.currentTarget.style.color = '#d4cdb3'}
                onMouseLeave={(e: React.MouseEvent<HTMLSpanElement>) => e.currentTarget.style.color = '#8f857a'}
              >
                {'>'} 把它拖回角落
              </span>
            </div>

            <div style={{ padding: '0 20px', flexShrink: 0, zIndex: 10 }}>
              <div 
                onClick={() => router.push('/write?emotion=numb')}
                style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2px', padding: '12px 16px', position: 'relative', cursor: 'pointer', background: 'rgba(0,0,0,0.3)', transform: `rotate(${randOffsets.board}deg)`, boxShadow: '2px 4px 10px rgba(0,0,0,0.5)', transition: 'transform 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0)'}
                onMouseLeave={e => e.currentTarget.style.transform = `rotate(${randOffsets.board}deg)`}
              >
                <div style={{ position: 'absolute', top: '-5px', left: '50%', transform: 'translateX(-50%) rotate(2deg)', width: '25px', height: '10px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(2px)' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                  <span style={{ color: '#9a8f85', fontSize: '9px', letterSpacing: '.2em', opacity: .5 }}>[今日排班]</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(212,149,106,0.05)', border: '1px dashed rgba(212,149,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#d4956a', fontSize: '10px', fontWeight: 500, opacity: 0.5 }}>A</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: '#d4956a', fontSize: '11px', opacity: ashIsMissing ? .4 : .9, textDecoration: ashIsMissing ? 'line-through' : 'none' }}>Ash</span>
                      <span style={{ color: '#8f857a', fontSize: '8px', opacity: .5 }}>{ashStatus}</span>
                    </div>
                    {ashMumble && !ashIsMissing && ( <div style={{ position: 'absolute', left: '90px', background: 'rgba(212,149,106,0.08)', border: '1px solid rgba(212,149,106,0.15)', padding: '4px 8px', borderRadius: '2px', fontSize: '9px', color: '#d4956a', opacity: 0.8, animation: 'fadeInOut 4s forwards' }}>{ashMumble}</div> )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(201,160,180,0.15)', border: '1px solid rgba(201,160,180,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(201,160,180,0.1)' }}><span style={{ color: '#c9a0b4', fontSize: '10px', fontWeight: 500 }}>R</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: '#c9a0b4', fontSize: '11px', opacity: .9, fontWeight: 'bold' }}>Rin</span>
                      <span style={{ color: '#c9a0b4', fontSize: '8px', opacity: .6 }}>{rinStatus}</span>
                    </div>
                    {rinMumble && ( <div style={{ position: 'absolute', left: '90px', background: 'rgba(201,160,180,0.08)', border: '1px solid rgba(201,160,180,0.15)', padding: '4px 8px', borderRadius: '2px', fontSize: '9px', color: '#c9a0b4', opacity: 0.8, animation: 'fadeInOut 4s forwards' }}>{rinMumble}</div> )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px', zIndex: 10 }}>
              <div
                onClick={() => !showEmotions && setShowEmotions(true)}
                style={{ background: '#e8e0d5', backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.015), rgba(0,0,0,0.015) 1px, transparent 1px, transparent 4px)', border: '1px solid rgba(0,0,0,0.08)', filter: 'saturate(0.92)', borderRadius: '2px', padding: '16px 14px', cursor: 'pointer', position: 'relative', transform: showEmotions ? 'rotate(0)' : `rotate(${randOffsets.paper}deg)`, boxShadow: showEmotions ? '0 10px 30px rgba(0,0,0,0.8)' : '2px 6px 15px rgba(0,0,0,0.6)', transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)', color: '#1a1612' }}
              >
                {!showEmotions ? (
                  <div>
                    <p style={{ color: '#555', fontSize: '9px', letterSpacing: '.2em', marginBottom: '8px' }}>空白留言本</p>
                    <p style={{ color: '#1a1612', fontSize: '14px', lineHeight: 1.7, fontWeight: 'bold' }}>有什么烂事<br />在这写下来</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {EMOTIONS.map((e) => (
                        <button
                          key={e.id}
                          onClick={(evt) => { evt.stopPropagation(); setSelected(e.id) }}
                          style={{ fontSize: '11px', color: selected === e.id ? '#e8e0d5' : '#1a1612', background: selected === e.id ? '#1a1612' : 'transparent', border: `1px solid ${selected === e.id ? '#1a1612' : 'rgba(0,0,0,0.3)'}`, padding: '6px 10px', borderRadius: '2px' }}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                    {selected && (
                      <button onClick={handleEnter} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#1a1612', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>压在吧台上 →</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '0 20px', flexShrink: 0, zIndex: 10 }}>
              <div onClick={() => router.push('/counter')} style={{ border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '4px', padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center', transform: `rotate(${randOffsets.basket}deg)` }}>
                <div style={{ flexShrink: 0, position: 'relative' }}>
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                    <path d="M4 12 L6 26 H26 L28 12 Z" stroke="rgba(154,143,133,0.3)" strokeWidth="0.8" fill="rgba(154,143,133,0.03)"/>
                    {hasBasketItems && ( <g opacity="0.3"><rect x="8" y="20" width="8" height="6" fill="#f5c842" /><circle cx="20" cy="22" r="3" fill="#a0c4a0" /></g> )}
                    <path d="M2 12 H30" stroke="rgba(154,143,133,0.3)" strokeWidth="0.8"/>
                    <path d="M10 12 L12 6 M22 12 L20 6" stroke="rgba(154,143,133,0.2)" strokeWidth="0.8"/>
                    <line x1="8" y1="17" x2="8" y2="22" stroke="rgba(154,143,133,0.15)" strokeWidth="1.5"/>
                    <line x1="15" y1="16" x2="15" y2="23" stroke="rgba(154,143,133,0.1)" strokeWidth="1.5"/>
                  </svg>
                </div>
                <div>
                  <p style={{ color: '#9a8f85', fontSize: '9px', letterSpacing: '.15em', margin: '0 0 4px', opacity: .4 }}>生锈的铁筐</p>
                  <p style={{ color: '#9a8f85', fontSize: '11px', letterSpacing: '.05em', margin: 0, opacity: .5 }}>{hasBasketItems ? '里面好像有东西' : '去看看别人留下的'}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 20px' }}>
              <div 
                onClick={printBlankReceipt}
                style={{ fontSize: '9px', color: '#6a5e52', textDecoration: 'underline dotted', cursor: 'pointer', opacity: 0.5, transition: '0.2s' }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.opacity = '0.5'}
              >
                打印机空转 —— 出一张空白小票
              </div>

              <div 
                onClick={() => router.push('/archive')}
                style={{ cursor: 'pointer', opacity: 0.4, display: 'flex', alignItems: 'center', gap: '6px', transition: 'opacity 0.3s' }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.opacity = '0.4'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="12" height="9" rx="1" stroke="#9a8f85" strokeWidth="0.8"/>
                  <line x1="1" y1="6" x2="13" y2="6" stroke="#9a8f85" strokeWidth="0.6"/>
                  <rect x="5" y="1" width="4" height="3" rx="0.5" stroke="#9a8f85" strokeWidth="0.7"/>
                </svg>
                <span style={{ color: '#9a8f85', fontSize: '9px', fontStyle: 'italic', letterSpacing: '0.15em' }}>拉开抽屉看看</span>
              </div>
            </div>

            <div style={{ marginTop: '28px', padding: '0 20px', opacity: 0.28, display: 'flex', flexDirection: 'column', gap: '18px', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f5c842', opacity: 0.3, animation: 'pulseDot 4s infinite' }}></div>
                <span style={{ color: '#9a8f85', fontSize: '10px', letterSpacing: '.08em' }}>收音机里有人在说天气预报...</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#8f857a', fontSize: '9px' }}>吧台角落那盆植物，好像很久没人浇水了</span>
              </div>
              <div style={{ marginTop: 'auto', padding: '30px 20px 0', opacity: .2 }}>
                <p style={{ color: '#9a8f85', fontSize: '9px', letterSpacing: '.15em', lineHeight: 1.8 }}>[ 不用注册。写完就撕。没人知道你来过。 ]</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}