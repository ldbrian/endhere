'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { track } from './lib/track'
import { recordCustomerAction } from './lib/memory'

const EMOTIONS = [
  { id: 'choke', label: '胸口堵得慌', emoji: '😮‍💨' },
  { id: 'tear', label: '眼眶有点热', emoji: '🥺' },
  { id: 'numb', label: '整个人木木的', emoji: '🫥' },
  { id: 'angry', label: '心里有股无名火', emoji: '🔥' },
  { id: 'shattered', label: '感觉快碎掉了', emoji: '🩹' },
]

// 彩蛋配置保持不变...
const EASTER_EGG_NOTES = [
  { id: 'ash_noodle', author: 'Ash', text: '大半夜饿得胃疼，挑了盒最贵的泡面，撕开倒完开水才发现里面根本没装调料包。\n老子现在只能吃一碗泡了热水的硬纸板。今天连吃个垃圾食品都不配拥有完整的垃圾吗？\n今晚别跟我说话。' },
  { id: 'rin_puddle', author: 'Rin', text: '下班太累没看路，一脚踩进了共享单车旁的黑水坑里。\n一路踩着湿透的鞋子挤地铁，到家门口一摸口袋，钥匙锁在吧台了。\n我现在正坐在家门口的楼道里吹穿堂风。对不起，今天实在不想温柔了。' },
  { id: 'child_shoes', author: '8岁的自己', text: '今天穿了最喜欢的新鞋子出门，但是踩到了好深好深的水坑！\n鞋子全变黑了，回家肯定又要挨骂了……\n我现在不敢回家，你可以把我藏在你的档案室里一天吗？' }
]

export default function Home() {
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(7)
  const [isBulbFixed, setIsBulbFixed] = useState(false)
  const [managerStatus, setManagerStatus] = useState('● 确认店长状态中...')
  const [statusColor, setStatusColor] = useState('var(--text-muted)')
  const [easterEgg, setEasterEgg] = useState<{ id: string, text: string, author: string } | null>(null)

  const router = useRouter()

  useEffect(() => {
    recordCustomerAction('visit')
    if (localStorage.getItem('fixed_light') === 'true' || localStorage.getItem('is_lifetime_vip') === 'true') {
      setIsBulbFixed(true)
    }

    const hour = new Date().getHours()
    if (hour >= 6 && hour < 18) {
      setManagerStatus('● 店长跑车挣电费中，暂由 AI 看店')
      setStatusColor('var(--text-muted)')
    } else if (hour >= 18 && hour < 23) {
      setManagerStatus('● 店长补觉中，晚点亲自营业')
      setStatusColor('#a0c4a0')
    } else {
      setManagerStatus('● 店长已深夜上线，吧台可压小票')
      setStatusColor('var(--warm-yellow)')
    }

    if (Math.random() < 0.05) {
      setEasterEgg(EASTER_EGG_NOTES[Math.floor(Math.random() * EASTER_EGG_NOTES.length)])
    }
  }, [])

  const handleEnter = () => {
    if (!selected) return
    track('enter_write', { emotion: selected, score })
    sessionStorage.setItem('emotion_score', String(score))
    router.push(`/write?emotion=${selected}`)
  }

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', padding: '40px 24px 60px' }}>
      
      {/* 背景光晕、状态牌、Logo及选项等保持完全一致... */}
      <div style={{ position: 'fixed', top: '35%', left: '50%', transform: 'translate(-50%, -50%)', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(245,200,66,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ padding: '6px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-10px' }}>
        <span style={{ color: statusColor, fontSize: '12px', transition: 'color 1s ease' }}>{managerStatus.charAt(0)}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.05em' }}>{managerStatus.slice(2)}</span>
      </div>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <img src="/logo.png" alt="End Here" className={isBulbFixed ? "" : "flicker-bulb"} style={{ width: '72px', height: '72px', opacity: 0.9 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.35em' }}>END HERE</p>
        <h1 className={isBulbFixed ? "" : "flicker-bulb"} style={{ color: 'var(--text-main)', fontSize: '32px', fontWeight: '300', letterSpacing: '0.15em', lineHeight: '1.8' }}>写下来 到此为止</h1>
      </div>

      <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />

      {easterEgg && (
        <div style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '4px', transform: 'rotate(-1.5deg)', position: 'relative', animation: 'fadeIn 0.6s ease-out' }}>
          <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '24px' }}>📌</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '10px', opacity: 0.6 }}>【收银台上钉着一张字条】</p>
          <p style={{ color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.8', opacity: 0.85, whiteSpace: 'pre-wrap' }}>{easterEgg.text}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '12px', textAlign: 'right', opacity: 0.5 }}>—— {easterEgg.author} 留</p>
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', letterSpacing: '0.15em' }}>现在的真实感觉是</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          {EMOTIONS.map((e) => (
            <button key={e.id} onClick={() => setSelected(e.id)} style={{ width: '100%', padding: '12px 20px', borderRadius: '999px', border: `1px solid ${selected === e.id ? 'var(--warm-yellow)' : 'var(--border)'}`, background: selected === e.id ? 'rgba(245,200,66,0.1)' : 'transparent', color: selected === e.id ? 'var(--warm-yellow)' : 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.25s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ letterSpacing: '0.05em' }}>{e.label}</span>
              <span style={{ fontSize: '15px' }}>{e.emoji}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>这股感觉有多重</p>
            <p style={{ color: 'var(--warm-yellow)', fontSize: '20px', fontWeight: '300' }}>{score}</p>
          </div>
          <input type="range" min={1} max={10} value={score} onChange={(e) => setScore(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--warm-yellow)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>还好</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.5 }}>已经满了</span>
          </div>
        </div>
      )}

      {/* === 核心修改区：底部的三大按钮 === */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <button
          onClick={handleEnter}
          disabled={!selected}
          style={{ 
            width: '100%', padding: '16px', borderRadius: '12px', 
            border: `1px solid ${selected ? 'rgba(245,200,66,0.3)' : 'var(--border)'}`, 
            background: selected ? 'rgba(245,200,66,0.08)' : 'transparent', 
            color: selected ? 'var(--warm-yellow)' : 'var(--text-muted)', 
            fontSize: '14px', letterSpacing: '0.15em', 
            cursor: selected ? 'pointer' : 'not-allowed', 
            transition: 'all 0.3s ease', opacity: selected ? 1 : 0.4 
          }}
        >
          {selected ? '随便丢点什么进去' : '先选个感觉'}
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/archive')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.3s ease', opacity: 0.8 }}>
            拉开抽屉看看
          </button>
          
          {/* 吧台入口保持不变 */}
          <button onClick={() => router.push('/counter')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px dashed rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.05)', color: 'var(--warm-yellow)', fontSize: '12px', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.3s ease', opacity: 0.8 }}>
            🏪 走向吧台
          </button>
        </div>

        {/* 把技术语言变成“没人关心你”的空间气味 */}
        <p style={{ 
          color: 'var(--text-muted)', fontSize: '11px', 
          textAlign: 'center', lineHeight: '1.8', opacity: 0.4,
          marginTop: '4px'
        }}>
          不用注册。没人关心你是谁。<br/>
          明早卷帘门一拉，没人记得你今晚来过。
        </p>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px) rotate(-1.5deg); }
          to { opacity: 1; transform: translateY(0) rotate(-1.5deg); }
        }
      `}</style>
    </div>
  )
}