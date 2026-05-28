'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { track } from '../lib/track'
import { createClient } from '@supabase/supabase-js'
import { useShelterStore } from '../store/useShelterStore'

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BASKET_GIFTS = [
  { id: 'milk', name: '温牛奶', icon: '🥛', price: '随意', desc: '安神。保质期 24 小时。' },
  { id: 'ice_water', name: '冰水', icon: '🧊', price: '随意', desc: '瞬间清醒。别拿别人的错惩罚自己。' },
  { id: 'candy', name: '水果糖', icon: '🍬', price: '随意', desc: '压一压生活里的苦味。' },
]

const SPONSOR_ITEMS = [
  { id: 'bulb', name: '钨丝灯泡', icon: '💡', price: '随意', desc: '店里的灯快憋了，换个新的。' },
  { id: 'paper', name: '热敏打印纸', icon: '📜', price: '随意', desc: '小票纸快用完了，进一卷。' },
]

function CounterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const receiptId = searchParams.get('receiptId') || ''
  const mode = searchParams.get('mode') || 'basket'
  
  const isManagerMode = mode === 'manager'
  
  const [mailboxStatus, setMailboxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [mailboxMsg, setMailboxMsg] = useState('')
  const [visible, setVisible] = useState(false)
  
  // 铁筐库存
  const [inventory, setInventory] = useState<Record<string, number>>({ milk: 0, candy: 0, ice_water: 0 })
  
  // 支付模态框状态
  const [payStep, setPayStep] = useState(false)
  const [paySuccess, setPaySuccess] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<any>(null)
  const [targetType, setTargetType] = useState<'basket' | 'sponsor'>('basket')

  const { entries, updateEntry } = useShelterStore()

  useEffect(() => {
    track('view_counter', { mode, receipt_id: receiptId })
    setTimeout(() => setVisible(true), 100)
    
    // 获取真实铁筐库存
    const fetchInventory = async () => {
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('iron_basket')
          .select('gift_id')
          .eq('status', 'available')
          .gte('created_at', twentyFourHoursAgo)
          
        // 先查物理天气，再算库存
        const { data: weatherData } = await supabase.from('world_state').select('event_type').eq('id', true).single()
        const isRaining = weatherData?.event_type === 'rain'

        if (data && !error) {
          const counts = data.reduce((acc: Record<string, number>, item: any) => {
            acc[item.gift_id] = (acc[item.gift_id] || 0) + 1
            return acc
          }, { milk: 0, candy: 0, ice_water: 0, umbrella: 0 }) // 加入 umbrella 初始化
          
          // 如果系统正在下雨，强行注入一把无限使用的旧雨伞
          if (isRaining) {
            counts.umbrella = 999 
          }
          
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
      const currentEntry = entries.find(e => e.receiptId === receiptId) || entries[0]
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
        if (currentEntry) updateEntry(currentEntry.id, { status: '已投递' })
      } else {
        setMailboxStatus('error')
        setMailboxMsg(data.message)
      }
    } catch (e) {
      setMailboxStatus('error')
      setMailboxMsg('网线可能被老鼠咬断了，稍后再试。')
    }
  }

  const handleOpenPay = (item: any, type: 'basket' | 'sponsor') => {
    setSelectedTarget(item)
    setTargetType(type)
    setPayStep(true)
  }

  const handlePayComplete = () => {
    setPaySuccess(true)
    if (targetType === 'basket') {
      track('leave_gift_success', { item_id: selectedTarget.id })
    } else {
      track('sponsor_shop_success', { item_id: selectedTarget.id })
    }
  }

  const isBasketEmpty = (inventory.milk + inventory.candy + inventory.ice_water) === 0

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '60px 20px', margin: '0 auto', opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center', marginBottom: '8px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.3em' }}>END HERE COUNTER</p>
        <h1 style={{ color: 'var(--text-main)', fontSize: '24px', fontWeight: '300', letterSpacing: '0.15em' }}>收银台</h1>
        {receiptId && <p style={{ color: 'var(--warm-yellow)', fontFamily: 'monospace', fontSize: '12px', opacity: 0.8, letterSpacing: '0.05em' }}>业务票号: #{receiptId}</p>}
      </div>

      {isManagerMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.4s ease-out' }}>
          <div style={{ padding: '24px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <div style={{ textAlign: 'left', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', borderLeft: '2px solid var(--warm-yellow)' }}>
              <p style={{ color: 'var(--warm-yellow)', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>店长留言规则：</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.8' }}>你的意见将被物理留存。店长跑完夜车回来看到后，可能会回复，也可能假装没看见。</p>
            </div>
            
            <button onClick={handleLeaveForManager} disabled={mailboxStatus !== 'idle'} style={{ width: '100%', padding: '16px', borderRadius: '8px', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)', color: 'var(--warm-yellow)', fontSize: '14px', cursor: mailboxStatus === 'success' ? 'default' : 'pointer', fontWeight: 'bold', letterSpacing: '0.1em' }}>
              {mailboxStatus === 'idle' ? '意见压在吧台下了' : mailboxStatus === 'loading' ? '正在塞进缝隙...' : mailboxStatus === 'success' ? '已妥投' : '投递失败: ' + mailboxMsg}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease-out' }}>
          
          {/* ================= 上半部：铁筐区 ================= */}
          <div style={{ width: '100%', padding: '24px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🧺</span>
              <span style={{ color: 'var(--text-main)', fontSize: '15px', letterSpacing: '0.1em', fontWeight: '500' }}>生锈的铁筐</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.7 }}>
              存放着别人留下的善意。24小时没人拿就会过期清理。
            </p>
            
            {isBasketEmpty ? (
              <div style={{ textAlign: 'center', padding: '16px 0', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em', opacity: 0.6 }}>店长还没有进货，今天筐里空空如也。</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                {inventory.milk > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>温牛奶</span>
                    <span style={{ fontSize: '13px', color: 'var(--warm-yellow)', fontWeight: 'bold', fontFamily: 'monospace' }}>x {inventory.milk}</span>
                  </div>
                )}
                {inventory.ice_water > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>冰水</span>
                    <span style={{ fontSize: '13px', color: 'var(--warm-yellow)', fontWeight: 'bold', fontFamily: 'monospace' }}>x {inventory.ice_water}</span>
                  </div>
                )}
                {inventory.candy > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>水果糖</span>
                    <span style={{ fontSize: '13px', color: 'var(--warm-yellow)', fontWeight: 'bold', fontFamily: 'monospace' }}>x {inventory.candy}</span>
                  </div>
                )}
                {inventory.umbrella > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>☂️ 遗落的旧雨伞</span>
                    <span style={{ fontSize: '13px', color: 'var(--warm-yellow)', opacity: 0.6, letterSpacing: '0.1em' }}>外面下雨，拿去撑吧</span>
                  </div>
                )}
              </div>
            )}

            {!payStep && !paySuccess && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>给后半夜来的人留点什么？</p>
                {BASKET_GIFTS.map(gift => (
                  <button key={gift.id} onClick={() => handleOpenPay(gift, 'basket')} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '18px' }}>{gift.icon}</span><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ color: 'var(--text-main)', fontSize: '12px' }}>{gift.name}</span><span style={{ color: 'var(--text-muted)', fontSize: '10px', opacity: 0.7 }}>{gift.desc}</span></div></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ================= 下半部：店铺赞助区 ================= */}
          {!payStep && !paySuccess && (
            <div style={{ width: '100%', padding: '24px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📓</span>
                <span style={{ color: 'var(--text-main)', fontSize: '15px', letterSpacing: '0.1em', fontWeight: '500' }}>吧台的账本</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.7 }}>
                店里的基建快耗尽了。<br/>如果不买吃的，也可以随缘赞助点耗材。
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {SPONSOR_ITEMS.map(item => (
                  <button key={item.id} onClick={() => handleOpenPay(item, 'sponsor')} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '18px' }}>{item.icon}</span><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ color: 'var(--text-main)', fontSize: '12px' }}>{item.name}</span><span style={{ color: 'var(--text-muted)', fontSize: '10px', opacity: 0.7 }}>{item.desc}</span></div></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================= 支付君子协议区（通用） ================= */}
          {payStep && !paySuccess && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', animation: 'fadeIn 0.3s ease', padding: '24px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)', width: '100%', justifyContent: 'center' }}>
                <span style={{ fontSize: '24px' }}>{selectedTarget.icon}</span>
                <span style={{ color: 'var(--text-main)', fontSize: '14px' }}> 
                  {targetType === 'basket' ? `留下一份 ${selectedTarget.name}` : `赞助一份 ${selectedTarget.name}`} 
                </span>
              </div>
              
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '2px solid rgba(255,255,255,0.2)', width: '100%' }}>
                 <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', margin: 0, lineHeight: '1.6' }}>
                   “零钱压吧台下就行，金额随意。次日我会去进货。” <br/>—— 店长留
                 </p>
              </div>

              <img src="/pay_code.png" alt="赞赏码" style={{ width: '140px', height: '140px', filter: 'grayscale(100%) contrast(1.2)', opacity: 0.85, borderRadius: '8px', marginTop: '8px' }} />
              
              <div style={{ display: 'flex', width: '100%', gap: '12px', marginTop: '8px' }}>
                <button onClick={() => setPayStep(false)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '12px' }}>算了</button>
                <button onClick={handlePayComplete} style={{ flex: 2, padding: '12px', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)', color: 'var(--warm-yellow)', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>钱压在玻璃板下了</button>
              </div>
            </div>
          )}

          {paySuccess && (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', animation: 'fadeIn 0.5s ease' }}>
              <span style={{ fontSize: '32px', opacity: 0.8 }}>☕</span>
              <p style={{ color: 'var(--text-main)', fontSize: '14px', marginTop: '16px', letterSpacing: '0.1em' }}>收到。</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px', opacity: 0.7, lineHeight: '1.8' }}>
                {targetType === 'basket' ? '店长跑完夜车回来会去把东西放进筐里的。' : '感谢。店里的灯又能多亮一晚上了。'}
                <br/>早点休息吧。
              </p>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
        <button onClick={() => router.push('/archive')} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.8 }}>离开收银台</button>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

export default function CounterPage() {
  return <Suspense><CounterContent /></Suspense>
}