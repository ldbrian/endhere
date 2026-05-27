'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { track } from '../lib/track'
import { createClient } from '@supabase/supabase-js'

// 初始化 Supabase 客户端，用于直接拉取真实库存
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const GIFTS = [
  { id: 'bandaid', name: '半日贴', icon: '🩹', price: '￥ 2.0', desc: '替下个流血的人买单，帮他物理封印 12 小时。' },
  { id: 'match', name: '一根旧火柴', icon: '🔥', price: '￥ 1.0', desc: '留一根在筐里，劝下个人把烂事彻底烧了。' },
  { id: 'milk', name: '待用热牛奶', icon: '🥛', price: '￥ 4.9', desc: '没别的用，给下个夜归人留杯热的暖暖手。' },
]

const GIFT_MSGS: Record<string, string[]> = {
  milk: [
    "今晚的夜路我替你跑了，早点睡。",
    "喝下这杯牛奶，烧掉这张小票，出门别回头。",
    "（什么也没说，只留下了这杯热牛奶）"
  ],
  bandaid: [
    "这个创可贴我没用上，我挺过来了，你也可以。",
    "伤口正在结痂，先别去抠它了。",
    "（什么也没说，只留下了这个创可贴）"
  ],
  match: [
    "陌生人，把它烧了吧，出门别回头。",
    "我替你买单了。点火，然后忘掉它。",
    "（什么也没说，只留下了这根火柴）"
  ]
}

function CounterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const receiptId = searchParams.get('receiptId') || ''
  const mode = searchParams.get('mode') || 'basket' 
  const isManagerMode = mode === 'manager'

  const [mailboxStatus, setMailboxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [mailboxMsg, setMailboxMsg] = useState('')
  const [visible, setVisible] = useState(false)
  
  // 核心改动：用真实库存状态替换掉以前的假随机数
  const [inventory, setInventory] = useState<Record<string, number>>({ milk: 0, bandaid: 0, match: 0 })

  const [selectedGift, setSelectedGift] = useState<any>(null)
  const [selectedMsg, setSelectedMsg] = useState<string>('')
  const [payStep, setPayStep] = useState(false)
  const [paySuccess, setPaySuccess] = useState(false)

  useEffect(() => {
    track('view_counter', { mode, receipt_id: receiptId })
    setTimeout(() => setVisible(true), 100)
    
    // 实时拉取数据库中的真实库存
    const fetchInventory = async () => {
      try {
        const { data, error } = await supabase
          .from('iron_basket')
          .select('gift_id')
          .eq('status', 'available')
        
        if (data && !error) {
          const counts = data.reduce((acc: Record<string, number>, item: any) => {
            acc[item.gift_id] = (acc[item.gift_id] || 0) + 1
            return acc
          }, { milk: 0, bandaid: 0, match: 0 })
          setInventory(counts)
        }
      } catch (err) {
        console.error('Failed to fetch inventory:', err)
      }
    }
    
    if (!isManagerMode) {
      fetchInventory()
    }
  }, [mode, receiptId, isManagerMode])

  const handleLeaveForManager = async () => {
    if (mailboxStatus === 'loading' || mailboxStatus === 'success') return
    setMailboxStatus('loading')
    try {
      const entries = JSON.parse(localStorage.getItem('entries') || '[]')
      const currentEntry = entries[0]
      const res = await fetch('/api/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, userMessage: currentEntry?.content || '', aiResponse: currentEntry?.rawResponse || '' })
      })
      const data = await res.json()
      if (data.success) {
        setMailboxStatus('success')
        setMailboxMsg(data.message)
        track('manager_mailbox_success', { receipt_id: receiptId })
        const storedEntries = JSON.parse(localStorage.getItem('entries') || '[]')
        const idx = storedEntries.findIndex((e: any) => e.receiptId === receiptId || e.id === storedEntries[0]?.id)
        if (idx !== -1) {
          storedEntries[idx].status = '等待回信'
          localStorage.setItem('entries', JSON.stringify(storedEntries))
        }
      } else {
        setMailboxStatus('error')
        setMailboxMsg(data.message)
      }
    } catch (e) {
      setMailboxStatus('error')
      setMailboxMsg('吧台抽屉卡住了。')
    }
  }

  const handlePayComplete = async () => {
    try {
      await fetch('/api/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId: selectedGift.id, giftIcon: selectedGift.icon, giftName: selectedGift.name, msg: selectedMsg }),
      })
      // 乐观更新：付完款后，前端立刻把货架上的数字 +1，体验极佳
      setInventory(prev => ({ ...prev, [selectedGift.id]: prev[selectedGift.id] + 1 }))
    } catch (e) { console.error(e) }
    setPaySuccess(true)
    track('leave_gift_success', { gift_id: selectedGift?.id })
  }

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '60px 20px', margin: '0 auto', opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center', marginBottom: '8px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.3em' }}>END HERE COUNTER</p>
        <h1 style={{ color: 'var(--text-main)', fontSize: '24px', fontWeight: '300', letterSpacing: '0.15em' }}>午夜收银台</h1>
        {receiptId && <p style={{ color: 'var(--warm-yellow)', fontFamily: 'monospace', fontSize: '12px', opacity: 0.8, letterSpacing: '0.05em' }}>小票暗号: #{receiptId}</p>}
      </div>

      {isManagerMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.4s ease-out' }}>
          <div style={{ padding: '24px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <div style={{ textAlign: 'left', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', borderLeft: '2px solid var(--warm-yellow)' }}>
              <p style={{ color: 'var(--warm-yellow)', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>【吧台规矩】</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.8' }}>1. 每天只收 7 张小票。<br/>2. 留一瓶水的钱 (￥4.9) 当作提神费。<br/>3. 不承诺一定回。看缘分。</p>
            </div>
            <img src="/pay_code.png" alt="投币码" style={{ width: '160px', height: '160px', filter: 'grayscale(100%) contrast(1.2)', opacity: 0.85, borderRadius: '8px' }} />
            <button onClick={handleLeaveForManager} disabled={mailboxStatus !== 'idle'} style={{ width: '100%', padding: '16px', borderRadius: '8px', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)', color: 'var(--warm-yellow)', fontSize: '14px', cursor: mailboxStatus === 'success' ? 'default' : 'pointer', fontWeight: 'bold', letterSpacing: '0.1em' }}>
              {mailboxStatus === 'idle' ? '已塞入 ￥4.9，压下小票' : mailboxStatus === 'loading' ? '正在压入...' : mailboxStatus === 'success' ? '卷帘门拉下，去睡吧。' : '❌ ' + mailboxMsg}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', padding: '24px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.4s ease-out' }}>
          
          {/* 核心改动：真实库存面板 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '20px', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🛒</span>
              <span style={{ color: 'var(--text-main)', fontSize: '15px', letterSpacing: '0.1em', fontWeight: '500' }}>角落的生锈铁筐</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.7 }}>
              往里面看了一眼，筐底静静地躺着这些陌生人留下的东西：
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>🥛 待用热牛奶</span>
                <span style={{ fontSize: '13px', color: 'var(--warm-yellow)', fontWeight: 'bold', fontFamily: 'monospace' }}>x {inventory.milk || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>🩹 半日贴</span>
                <span style={{ fontSize: '13px', color: 'var(--warm-yellow)', fontWeight: 'bold', fontFamily: 'monospace' }}>x {inventory.bandaid || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>🔥 一根旧火柴</span>
                <span style={{ fontSize: '13px', color: 'var(--warm-yellow)', fontWeight: 'bold', fontFamily: 'monospace' }}>x {inventory.match || 0}</span>
              </div>
              
              <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>🎫 店长的免单券</span>
                  <span style={{ fontSize: '13px', color: 'var(--warm-yellow)', fontWeight: 'bold', fontFamily: 'monospace' }}>x ?</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.5', margin: 0, opacity: 0.6, fontStyle: 'italic' }}>
                  *如果有幸在这座喧闹的城市打到店长的车，给店长看这张券，他会免费送你一程。
                </p>
              </div>
            </div>
          </div>

          {!payStep && !paySuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: 'var(--text-main)', fontSize: '13px', letterSpacing: '0.1em', fontWeight: '500' }}>结账了。顺手给下个人留点什么吗？</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {GIFTS.map(gift => (
                  <button key={gift.id} onClick={() => { setSelectedGift(gift); setPayStep(true); setSelectedMsg(''); }} style={{ width: '100%', padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '20px' }}>{gift.icon}</span><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ color: 'var(--text-main)', fontSize: '13px' }}>{gift.name}</span><span style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.7 }}>{gift.desc}</span></div></div>
                    <span style={{ color: 'var(--warm-yellow)', fontSize: '12px', fontWeight: 'bold' }}>{gift.price}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : payStep && !paySuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}><span style={{ fontSize: '24px' }}>{selectedGift.icon}</span><span style={{ color: 'var(--text-main)', fontSize: '14px' }}>留一份【{selectedGift.name}】</span></div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>只能从下面选一句话贴在上面：</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {GIFT_MSGS[selectedGift.id].map((msg, idx) => (
                  <div key={idx} onClick={() => setSelectedMsg(msg)} style={{ padding: '12px', borderRadius: '6px', border: `1px solid ${selectedMsg === msg ? 'var(--warm-yellow)' : 'rgba(255,255,255,0.1)'}`, background: selectedMsg === msg ? 'rgba(245,200,66,0.08)' : 'transparent', color: selectedMsg === msg ? 'var(--warm-yellow)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>{msg}</div>
                ))}
              </div>
              {selectedMsg && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <img src="/pay_code.png" alt="打赏码" style={{ width: '120px', height: '120px', filter: 'grayscale(100%) contrast(1.2)', opacity: 0.85, borderRadius: '8px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>扫码支付 {selectedGift.price}</p>
                  <div style={{ display: 'flex', width: '100%', gap: '12px' }}>
                    <button onClick={() => {setPayStep(false); setSelectedMsg('');}} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '13px' }}>放回去</button>
                    <button onClick={handlePayComplete} style={{ flex: 2, padding: '12px', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)', color: 'var(--warm-yellow)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>我已经付了</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0 16px', animation: 'fadeIn 0.5s ease' }}>
              <span style={{ fontSize: '32px', opacity: 0.8 }}>📦</span>
              <p style={{ color: 'var(--text-main)', fontSize: '14px', marginTop: '16px', letterSpacing: '0.1em' }}>滴——支付成功。</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px', opacity: 0.7, lineHeight: '1.8' }}>你没有把它塞进自己的兜里。<br/>而是顺手扔进了旁边的铁筐里。</p>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
        <button onClick={() => router.push('/archive')} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.8 }}>推门离开，去看看抽屉</button>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

export default function CounterPage() {
  return <Suspense><CounterContent /></Suspense>
}