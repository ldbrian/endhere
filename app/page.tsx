'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { track } from './lib/track'
import PlasticBag from './components/PlasticBag'
import { recordCustomerAction } from './lib/memory'
import { createClient } from '@supabase/supabase-js'
import { useTraces } from './hooks/useTraces'
import { useEntityStore } from './store/useEntityStore'

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

const MISHAPS = [
  '泡面没调料包',
  '钥匙掉水沟里了',
  '踩到口香糖',
  '伞被风吹翻',
  '手机摔出一条裂痕',
  '店员跑车被贴条了',
]

// ─────────────────────────────────────────────────
// SVG 素材库（纯视觉原子，不含交互逻辑）
// ─────────────────────────────────────────────────

const BulbSVG = ({ flicker }: { flicker: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
    <circle cx="13" cy="11" r="7" stroke="#f5c842" strokeWidth="1.2" opacity="0.9" />
    <path d="M10 18h6M11 20.5h4" stroke="#f5c842" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    <circle cx="13" cy="11" r="3" fill="#f5c842" opacity="0.25" />
    <circle cx="13" cy="11" r="9" stroke="#f5c842" strokeWidth="0.4" opacity="0.18"
      style={{ animation: flicker ? 'gentleFlicker 8s infinite ease-in-out' : 'none' }} />
  </svg>
)

const ReceiptSVG = () => (
  <svg width="30" height="40" viewBox="0 0 34 44" fill="none" style={{ flexShrink: 0 }}>
    {[0,4,8,12,16,20,24,28].map(x => (
      <path key={x} d={`M${x+1} 5 l2-5 l2 5`} fill="rgba(245,200,66,0.07)" stroke="rgba(245,200,66,0.2)" strokeWidth="0.6" />
    ))}
    <rect x="1" y="5" width="32" height="38" rx="1" fill="rgba(245,200,66,0.05)" stroke="rgba(245,200,66,0.18)" strokeWidth="0.8" />
    <line x1="6" y1="13" x2="28" y2="13" stroke="rgba(245,200,66,0.28)" strokeWidth="0.5" />
    <line x1="6" y1="18" x2="24" y2="18" stroke="rgba(245,200,66,0.16)" strokeWidth="0.5" />
    <line x1="6" y1="23" x2="26" y2="23" stroke="rgba(245,200,66,0.16)" strokeWidth="0.5" />
    <line x1="6" y1="28" x2="21" y2="28" stroke="rgba(245,200,66,0.1)" strokeWidth="0.5" />
    <line x1="6" y1="33" x2="23" y2="33" stroke="rgba(245,200,66,0.1)" strokeWidth="0.5" />
    <line x1="22" y1="38" x2="28" y2="38" stroke="rgba(245,200,66,0.2)" strokeWidth="0.5" />
  </svg>
)

const BasketSVG = () => (
  <svg width="32" height="30" viewBox="0 0 36 34" fill="none" style={{ flexShrink: 0 }}>
    <path d="M3 13 L5.5 29 H30.5 L33 13 Z" stroke="rgba(154,143,133,0.4)" strokeWidth="0.9" fill="rgba(154,143,133,0.04)" />
    <path d="M1 13 H35" stroke="rgba(154,143,133,0.45)" strokeWidth="0.9" />
    <path d="M11 13 L13 7 M25 13 L23 7" stroke="rgba(154,143,133,0.3)" strokeWidth="0.9" />
    <line x1="9" y1="18" x2="9" y2="24" stroke="rgba(154,143,133,0.2)" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="17" y1="17" x2="17" y2="26" stroke="rgba(154,143,133,0.14)" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="25" y1="18" x2="25" y2="23" stroke="rgba(154,143,133,0.2)" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="21" r="3" fill="rgba(245,200,66,0.1)" stroke="rgba(245,200,66,0.22)" strokeWidth="0.7" />
    <rect x="19" y="18" width="9" height="6" rx="1" fill="rgba(154,143,133,0.07)" stroke="rgba(154,143,133,0.22)" strokeWidth="0.7" />
    <path d="M21 18 L21 15 L27 15 L27 18" stroke="rgba(154,143,133,0.2)" strokeWidth="0.6" fill="none" />
  </svg>
)

const ClockSVG = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="9" cy="9" r="7" stroke="rgba(154,143,133,0.35)" strokeWidth="0.7" />
    <line x1="9" y1="9" x2="9" y2="5" stroke="rgba(154,143,133,0.4)" strokeWidth="0.7" />
    <line x1="9" y1="9" x2="12" y2="9" stroke="rgba(154,143,133,0.4)" strokeWidth="0.7" />
  </svg>
)

const ArchiveSVG = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="4" width="14" height="10" rx="1" stroke="rgba(154,143,133,0.45)" strokeWidth="0.8" />
    <line x1="1" y1="7.5" x2="15" y2="7.5" stroke="rgba(154,143,133,0.35)" strokeWidth="0.7" />
    <rect x="5.5" y="1.5" width="5" height="3.5" rx="0.5" stroke="rgba(154,143,133,0.4)" strokeWidth="0.7" />
    <line x1="4" y1="10.5" x2="12" y2="10.5" stroke="rgba(154,143,133,0.2)" strokeWidth="0.6" />
  </svg>
)

const ConstructionZoneSVG = () => (
  <div style={{
    position: 'absolute', inset: 0,
    opacity: 0.11,
    display: 'flex', flexDirection: 'column',
    gap: '12px', padding: '20px 16px',
    fontFamily: 'monospace', pointerEvents: 'none',
    overflow: 'hidden',
  }}>
    <div style={{ border: '1px solid #9a8f85', padding: '8px 10px', fontSize: '8px', color: '#9a8f85', letterSpacing: '.1em' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '7px' }}>
        <span>货架A</span><span>货架B</span><span>货架C</span>
      </div>
      <div style={{ display: 'flex', gap: '3px' }}>
        {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: '18px', border: '1px solid #9a8f85', opacity: .5 }} />)}
      </div>
    </div>
    <div style={{ border: '1px solid #9a8f85', padding: '8px 10px', fontSize: '8px', color: '#9a8f85', letterSpacing: '.1em' }}>
      <div>[老旧冰柜 · 尚未通电]</div>
      <div style={{ marginTop: '4px', height: '24px', border: '1px dashed #9a8f85', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '7px', opacity: .6 }}>220V ──×──</div>
      </div>
    </div>
    <div style={{ border: '1px dashed #9a8f85', padding: '8px 10px', fontSize: '8px', color: '#9a8f85', letterSpacing: '.1em' }}>
      [靠窗空位 · 待清扫]
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        {[0,1].map(i => <div key={i} style={{ width: '20px', height: '20px', border: '1px solid #9a8f85', opacity: .4, borderRadius: '50%' }} />)}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: .7 }}>
      <ClockSVG />
      <span style={{ fontSize: '7px', color: '#9a8f85', letterSpacing: '.1em' }}>[时钟 · 电池没了]</span>
    </div>
  </div>
)

// ActionLink 工具组件
const ActionLink = ({ onClick, children, show = true }: { onClick: () => void, children: React.ReactNode, show?: boolean }) => {
  if (!show) return null
  return (
    <span
      onClick={onClick}
      style={{ color: '#554f47', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '4px', transition: 'color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.color = '#a89f91'}
      onMouseLeave={e => e.currentTarget.style.color = '#554f47'}
    >
      {children}
    </span>
  )
}

export default function Home() {
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(null)
  const [score] = useState(7)
  const [showEmotions, setShowEmotions] = useState(false)
  const [mishap, setMishap] = useState<string | null>(null)
  const [isBulbFixed, setIsBulbFixed] = useState(false)
  const [signShake, setSignShake] = useState(false)
  const [clockStr, setClockStr] = useState('')

  const [activeEvent, setActiveEvent] = useState<'clear' | 'rain' | 'broken_bulb'>('clear')
  const [timeStateStr, setTimeStateStr] = useState<string>('...')

  const [ashStatus, setAshStatus] = useState('理货中')
  const [rinStatus, setRinStatus] = useState('打盹中')
  const [ashMumble, setAshMumble] = useState<string | null>(null)
  const [rinMumble, setRinMumble] = useState<string | null>(null)
  const ashIsMissing = ashStatus === '后巷抽烟' || ashStatus === '不知道去哪了'

  const [hasBasketItems, setHasBasketItems] = useState(false)
  const [radioText, setRadioText] = useState('收音机里有人在说天气预报...')
  const [plantText, setPlantText] = useState('吧台角落那盆植物，好像很久没人浇水了')
  const [ambientSound, setAmbientSound] = useState<string | null>(null)

  const { getTraceStatus } = useTraces()
  const stoolTrace = getTraceStatus('broken_stool', { hot: '凳面还有一点余温...', warm: '旁边有半杯没喝完的凉水...', cold: '' })

  const stoolLocation = useEntityStore(state => state.stoolLocation)
  const moveStool = useEntityStore(state => state.moveStool)
  const onTop = useEntityStore(state => state.onTop)
  const toggleSit = useEntityStore(state => state.toggleSit)
  const [isSpacedOutReady, setIsSpacedOutReady] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (onTop === 'human') {
      timer = setTimeout(() => setIsSpacedOutReady(true), 10000)
    } else {
      setIsSpacedOutReady(false)
    }
    return () => { if (timer) clearTimeout(timer); setIsSpacedOutReady(false) }
  }, [onTop])

  // 数字时钟：只显示时分
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      setClockStr(`${h}:${m}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // 活物引擎：收音机、植物、环境声
  useEffect(() => {
    const radioTimer = setTimeout(() => {
      setRadioText('收音机里传出沙沙声，开始放一首不知名的旧歌...')
    }, 12000)
    const plantTimer = setTimeout(() => {
      setPlantText('吧台角落那盆植物静悄悄的，刚刚掉了一片叶子。')
    }, 25000)
    const ghostSounds = [
      '角落传来塑料袋轻轻摩擦的声音...',
      '窗外好像有一辆深夜公交车隆隆驶过...',
      '门外的风把铁皮招牌吹得嘎吱响了一声...',
      '头顶的灯管微微发出几声嗞嗞的电流声...'
    ]
    const soundInterval = setInterval(() => {
      if (Math.random() > 0.3) {
        setAmbientSound(ghostSounds[Math.floor(Math.random() * ghostSounds.length)])
        setTimeout(() => setAmbientSound(null), 4000)
      }
    }, 15000)
    return () => { clearTimeout(radioTimer); clearTimeout(plantTimer); clearInterval(soundInterval) }
  }, [])

  // 停留时长打点
  useEffect(() => {
    const enterTime = Date.now()
    return () => {
      track('stay_duration', { page: 'home', duration_seconds: Math.round((Date.now() - enterTime) / 1000) })
    }
  }, [])

  // 店员倒霉小票（5%）
  useEffect(() => {
    const alreadyShown = sessionStorage.getItem('mishap_shown')
    if (!alreadyShown && Math.random() < 0.05) {
      const randomMishap = MISHAPS[Math.floor(Math.random() * MISHAPS.length)]
      setMishap(randomMishap)
      sessionStorage.setItem('mishap_shown', 'true')
      setTimeout(() => setMishap(null), 10000)
    }
  }, [])

  // 时间状态 + 店员喃喃
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

  // Supabase 数据同步
  useEffect(() => {
    recordCustomerAction('visit')
    if (localStorage.getItem('fixed_light') === 'true' || localStorage.getItem('is_lifetime_vip') === 'true') {
      setIsBulbFixed(true)
    }
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

  const printBlankReceipt = () => alert('「你什么也没说。店也不知道你在想什么。这样也行。」')

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#141210',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'sans-serif', lineHeight: 2, letterSpacing: '0.05em',
      overflowX: 'hidden', alignItems: 'center',
      position: 'relative',
      width: '100%',
    }}>
      <style>{`
        /* 【核心防跳动修复】：强行开启页面级垂直滚动条与稳定轨道，杜绝任何因高度变化引发的宽度挤压跳动 */
        html {
          overflow-y: scroll !important;
          scrollbar-gutter: stable;
          background-color: #141210;
        }
        html, body {
          overflow-x: hidden;
          width: 100%;
          margin: 0;
          padding: 0;
          background-color: #141210;
        }
        *, *::before, *::after {
          box-sizing: border-box;
        }

        @keyframes pulseDot { 0%,100%{opacity:.15} 50%{opacity:.6} }
        @keyframes fadeInOut { 0%{opacity:0;transform:translateX(-5px)} 10%{opacity:1;transform:translateX(0)} 90%{opacity:1;transform:translateX(0)} 100%{opacity:0;transform:translateX(5px)} }
        @keyframes shake {
          0%,100%{transform:translate(-50%,-50%) rotate(-3deg)}
          20%{transform:translate(-53%,-50%) rotate(-10deg)}
          40%{transform:translate(-47%,-50%) rotate(3deg)}
          60%{transform:translate(-52%,-50%) rotate(-7deg)}
          80%{transform:translate(-49%,-50%) rotate(0deg)}
        }
        @keyframes gentleFlicker { 0%,89%,100%{opacity:1} 90%{opacity:.65} 93%{opacity:.9} 96%{opacity:.7} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        
        .btn-action { transition: all 0.25s ease; }
        .btn-action:hover { opacity: 1 !important; }
      `}</style>

      {/* 全局噪点结界 */}
      <div style={{ pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.015), transparent 70%)' }} />
      {/* 扫描线 */}
      <div style={{ pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 1, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.025) 3px,rgba(0,0,0,0.025) 4px)' }} />

      <div style={{ width: '100%', maxWidth: '520px', padding: '0 24px', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column' }}>

        {/* ══════════════════════════════════════
            HEADER (保留塑料袋高度微调)
        ══════════════════════════════════════ */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '24px 0 16px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/logo.png" alt="End Here" style={{ width: '18px', height: '18px', filter: 'grayscale(100%) sepia(100%) hue-rotate(15deg) brightness(0.6)' }} />
              <span style={{ color: '#e8e0d5', fontSize: '13px', letterSpacing: '0.22em', fontWeight: 300 }}>END HERE</span>
              <span style={{ color: '#554f47', fontSize: '9px', letterSpacing: '.1em' }}>便利店</span>
            </div>
            <p style={{ color: '#554f47', fontSize: '8px', letterSpacing: '.15em', opacity: .45, paddingLeft: '2px' }}>
              断网巷 404 号 · 全年无休 · 不留名
            </p>
          </div>
          <div style={{ pointerEvents: 'auto', zIndex: 50, transform: 'rotate(2deg)', opacity: 0.8, marginTop: '-6px' }}>
            <PlasticBag />
          </div>
        </header>

        {/* 环境音效浮现 */}
        {ambientSound && (
          <div style={{ color: '#554f47', fontSize: '9px', fontStyle: 'italic', letterSpacing: '0.1em', padding: '8px 0 0', animation: 'fadeInOut 4s forwards', textAlign: 'center' }}>
            [ {ambientSound} ]
          </div>
        )}

        {/* ══════════════════════════════════════
            环境状态播报 + 数字时钟
        ══════════════════════════════════════ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#6b7280', opacity: .3, display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
            <span style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '.05em' }}>
              {activeEvent === 'rain' ? '外面还在下雨...' : activeEvent === 'broken_bulb' ? '有颗灯泡在闪...' : timeStateStr}
            </span>
          </div>
          {/* 数字时钟 (保留时分降级) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#0a0906',
            border: '1px solid rgba(245,200,66,0.12)',
            borderRadius: '3px',
            padding: '4px 10px',
            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.8), 0 0 6px rgba(245,200,66,0.04)',
            position: 'relative', overflow: 'hidden',
          }}>
            <span style={{
              width: '3px', height: '3px', borderRadius: '50%',
              background: '#c0392b', opacity: 0.7,
              boxShadow: '0 0 3px #c0392b',
              display: 'inline-block',
            }} />
            <span style={{
              color: '#d4440a',
              fontSize: '12px',
              fontFamily: '"Courier New", "Lucida Console", monospace',
              fontWeight: 700,
              letterSpacing: '.15em',
              fontVariantNumeric: 'tabular-nums',
              textShadow: '0 0 8px rgba(212,68,10,0.6), 0 0 2px rgba(212,68,10,0.4)',
              lineHeight: 1,
            }}>{clockStr || '──:──'}</span>
          </div>
        </div>
        {mishap && (
          <div style={{ color: '#8f857a', fontSize: '9px', opacity: .6, animation: 'fadeInOut 10s forwards', padding: '0 0 6px' }}>
            [店员] {mishap}
          </div>
        )}

        {/* ══════════════════════════════════════
            收银台区（留言本 + 物件）
        ══════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '16px' }}>

          <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,rgba(245,200,66,0.2) 30%,rgba(245,200,66,0.08) 70%,transparent)', marginBottom: '-16px' }} />

          {/* 留言本（核心入口）
              【切断溢出】：增加 overflow: hidden 和 boxSizing: border-box，确保子元素绝对无法撑开容器物理宽度
          */}
          <div
            onClick={() => !showEmotions && setShowEmotions(true)}
            style={{
              borderTop: '2px solid rgba(245,200,66,0.12)',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              padding: '28px 12px',
              cursor: showEmotions ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', gap: '20px',
              background: showEmotions ? 'rgba(20,18,16,0.4)' : 'transparent',
              transition: 'background-color 0.3s ease',
              width: '100%', boxSizing: 'border-box', overflow: 'hidden',
            }}
          >
            {!showEmotions ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
                <ReceiptSVG />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ color: '#554f47', fontSize: '9px', letterSpacing: '.2em' }}>[ 空白留言本 ]</p>
                  <p style={{ color: '#e5e7eb', fontSize: '15px', fontWeight: 400, letterSpacing: '.15em', lineHeight: '2.2' }}>
                    想写些什么？
                  </p>
                  <p style={{ color: '#4b5563', fontSize: '9px', letterSpacing: '.1em', marginTop: '4px' }}>点开 →</p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', animation: 'fadeInUp 0.3s ease' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
                  {EMOTIONS.map(e => (
                    <button
                      key={e.id}
                      onClick={evt => { evt.stopPropagation(); setSelected(e.id) }}
                      style={{
                        fontSize: '11px', padding: '8px 16px',
                        border: `1px solid ${selected === e.id ? '#e5e7eb' : '#374151'}`,
                        color: selected === e.id ? '#e5e7eb' : '#6b7280',
                        background: selected === e.id ? '#111827' : 'transparent',
                        transition: 'all 0.2s', cursor: 'pointer',
                      }}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
                {selected && (
                  <button
                    onClick={handleEnter}
                    style={{ alignSelf: 'flex-start', color: '#e5e7eb', fontSize: '11px', letterSpacing: '.1em', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '4px' }}
                  >
                    压在吧台上 →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 吧台凳子区 */}
          {stoolLocation === 'bar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 12px', opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', letterSpacing: '.05em', color: onTop === 'human' ? '#d1d5db' : '#554f47' }}>
                  {onTop === 'human' ? '[ 你正坐在破木凳上 ]' : '[ 一把破木凳停在吧台前 ]'}
                </span>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <ActionLink onClick={() => { const current = useEntityStore.getState().onTop; toggleSit(); if (current === null) router.push('/sit') }}>
                    {onTop === 'human' ? '> 站起来' : '> 坐下'}
                  </ActionLink>
                  <ActionLink show={onTop === null} onClick={() => moveStool('corner')}>{'> 拖回角落'}</ActionLink>
                </div>
              </div>
              {onTop === 'human' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'opacity 3s', opacity: isSpacedOutReady ? 1 : 0, pointerEvents: isSpacedOutReady ? 'auto' : 'none' }}>
                  <span style={{ color: '#4b5563', fontSize: '9px' }}>[ 盯着周围看久了，思绪开始变轻。 ]</span>
                  <ActionLink onClick={() => router.push('/sit')}>{'> 闭上眼睛'}</ActionLink>
                </div>
              )}
            </div>
          )}

          {/* 店员喃喃 */}
          {(ashMumble || rinMumble) && (
            <div style={{ display: 'flex', gap: '12px', padding: '0 12px', animation: 'fadeInUp 0.4s ease' }}>
              {ashMumble && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(212,149,106,0.12)', border: '1px solid rgba(212,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#d4956a', fontSize: '9px', fontWeight: 500 }}>A</span>
                  </div>
                  <span style={{ color: '#554f47', fontSize: '10px', fontStyle: 'italic' }}>{ashMumble}</span>
                </div>
              )}
              {rinMumble && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(201,160,180,0.12)', border: '1px solid rgba(201,160,180,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#c9a0b4', fontSize: '9px', fontWeight: 500 }}>R</span>
                  </div>
                  <span style={{ color: '#554f47', fontSize: '10px', fontStyle: 'italic' }}>{rinMumble}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            功能连接区（铁筐 + 值班表）
        ══════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingTop: '8px', paddingBottom: '24px', borderBottom: '1px dashed rgba(255,255,255,0.03)' }}>

          <div
            onClick={() => router.push('/counter')}
            style={{ border: '1px solid rgba(255,255,255,0.04)', borderRadius: '4px', padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center', opacity: 0.6, transition: 'all 0.3s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
          >
            <BasketSVG />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ color: '#4b5563', fontSize: '9px', letterSpacing: '.15em' }}>[ 生锈的铁筐 ]</span>
              <span style={{ color: '#6b7280', fontSize: '10px' }}>{hasBasketItems ? '里面好像有东西...' : '空着的'}</span>
            </div>
            <span style={{ color: '#4b5563', fontSize: '9px', marginLeft: 'auto' }}>去看看 ➔</span>
          </div>

          <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(212,149,106,0.12)', border: '1px solid rgba(212,149,106,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#d4956a', fontSize: '8px', fontWeight: 500 }}>A</span>
                </div>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(201,160,180,0.12)', border: '1px solid rgba(201,160,180,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#c9a0b4', fontSize: '8px', fontWeight: 500 }}>R</span>
                </div>
              </div>
              <span style={{ color: '#4b5563', fontSize: '9px', letterSpacing: '.1em' }}>[今日值班]</span>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ color: '#6b7280', fontSize: '10px', textDecoration: ashIsMissing ? 'line-through' : 'none' }}>Ash ({ashStatus})</span>
              <span style={{ color: '#9ca3af', fontSize: '10px' }}>Rin ({rinStatus})</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            底噪生命体：收音机 + 植物（值班表下方）
        ══════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 16px 20px', opacity: 0.35 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f5c842', opacity: .3, display: 'inline-block', animation: 'pulseDot 4s infinite', flexShrink: 0 }} />
            <span style={{ color: '#4b5563', fontSize: '9px', letterSpacing: '.05em', fontStyle: 'italic' }}>{radioText}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px' }}>
            <span style={{ color: '#374151', fontSize: '9px', fontStyle: 'italic' }}>{plantText}</span>
          </div>
        </div>

        {/* ══════════════════════════════════════
            深处探索区（档案室 + 角落凳子）
        ══════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', paddingTop: '40px', paddingBottom: '48px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' }}>
            <ActionLink onClick={printBlankReceipt}>打印机空转</ActionLink>
            <span
              onClick={() => router.push('/archive')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563', fontSize: '10px', cursor: 'pointer', fontStyle: 'italic', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#9ca3af'}
              onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}
            >
              <ArchiveSVG />
              [ 拉开抽屉 ] ➔ 档案存档
            </span>
          </div>

          {/* 角落里的破木凳 */}
          {stoolLocation === 'corner' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 12px', alignItems: 'center', opacity: 0.6 }}>
              <span style={{ color: onTop === 'human' ? '#6b7280' : '#4b5563', fontSize: '10px', letterSpacing: '.1em' }}>
                {onTop === 'human' ? '[ 你正坐在破木凳上 ]' : '[ 角落里的破木凳 ]'}
              </span>
              {onTop === null && stoolTrace && <span style={{ color: '#374151', fontSize: '9px' }}>{stoolTrace}</span>}
              <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                <ActionLink onClick={() => { const current = useEntityStore.getState().onTop; toggleSit(); if (current === null) router.push('/sit') }}>
                  {onTop === 'human' ? '> 站起来' : '> 坐下发呆'}
                </ActionLink>
                <ActionLink show={onTop === null} onClick={() => moveStool('bar')}>{'> 移到吧台'}</ActionLink>
              </div>
              {onTop === 'human' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: isSpacedOutReady ? 1 : 0, pointerEvents: isSpacedOutReady ? 'auto' : 'none', transition: 'opacity 3s ease-in', marginTop: '16px' }}>
                  <span style={{ color: '#6a5e52', fontSize: '9px', letterSpacing: '.1em' }}>[ 你的思绪开始变轻。 ]</span>
                  <ActionLink onClick={() => router.push('/sit')}>{'> 顺着思绪沉没'}</ActionLink>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            施工区
        ══════════════════════════════════════ */}
        <div
          onClick={() => { setSignShake(true); setTimeout(() => setSignShake(false), 600) }}
          style={{ position: 'relative', height: '180px', margin: '24px 0 8px', cursor: 'pointer', overflow: 'hidden' }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '7px',
            background: 'repeating-linear-gradient(90deg,#f5c842 0,#f5c842 14px,#050505 14px,#050505 28px)',
            opacity: .28, zIndex: 3,
          }} />
          <ConstructionZoneSVG />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(5,5,5,0.82)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 1,
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) rotate(-3deg)',
            animation: signShake ? 'shake 0.5s ease' : 'none',
            zIndex: 4,
          }}>
            <div style={{
              padding: '14px 20px',
              background: 'rgba(5,5,5,0.96)',
              border: '1.5px solid rgba(245,200,66,0.55)',
              borderRadius: '2px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(245,200,66,0.03) 5px,rgba(245,200,66,0.03) 10px)',
                pointerEvents: 'none',
              }} />
              <div style={{ position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', width: '36px', height: '10px', background: 'rgba(245,200,66,0.2)', borderRadius: '1px' }} />
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <div style={{ color: 'rgba(245,200,66,0.88)', fontSize: '10px', letterSpacing: '.25em', fontFamily: 'monospace', marginBottom: '4px' }}>⚠ 内部区域</div>
                <div style={{ color: 'rgba(245,200,66,0.55)', fontSize: '9px', letterSpacing: '.15em', fontFamily: 'monospace' }}>还没收拾好</div>
              </div>
            </div>
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
            background: 'repeating-linear-gradient(90deg,rgba(245,200,66,0.15) 0,rgba(245,200,66,0.15) 5px,transparent 5px,transparent 10px)',
            zIndex: 4,
          }} />
        </div>

        {/* ══════════════════════════════════════
            绝对底噪
        ══════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', opacity: 0.14, paddingTop: '16px', paddingBottom: '64px' }}>
          <span style={{ color: '#747477', fontSize: '9px' }}>[ 内部区域暂时封闭 ]</span>
          <p style={{ color: '#747477', fontSize: '9px', letterSpacing: '.1em', marginTop: '16px' }}>
            [ 不用注册。写完就撕。没人知道你来过。 ]
          </p>
        </div>

      </div>
    </div>
  )
}