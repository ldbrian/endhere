'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { trackSpaceEvent } from '../lib/telemetry'
import { createClient } from '@supabase/supabase-js'
import { useShelterStore } from '../store/useShelterStore'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BASKET_GIFTS = [
  { id: 'milk', name: '温牛奶', icon: '🥛', desc: '安神。保质期 24 小时。' },
  { id: 'ice_water', name: '冰水', icon: '🧊', desc: '瞬间清醒。别拿别人的错惩罚自己。' },
  { id: 'candy', name: '水果糖', icon: '🍬', desc: '压一压生活里的苦味。' },
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
  
  const [inventory, setInventory] = useState<Record<string, number>>({ milk: 0, candy: 0, ice_water: 0 })
  const [leftItem, setLeftItem] = useState<string | null>(null) // 物理放置物品反馈状态

  const { entries, updateEntry } = useShelterStore()

  // ================= P3: 小票打印机状态 =================
  const [printerState, setPrinterState] = useState<'idle' | 'printing_1' | 'printing_2' | 'printing_3' | 'done'>('idle')
  const [receiptData, setReceiptData] = useState({ arrivalText: '', stayMinutes: 0, entriesCount: 0 })

  useEffect(() => {
    trackSpaceEvent('EVENT_VIEW_COUNTER', { mode, receipt_id: receiptId })
    setTimeout(() => setVisible(true), 100)
    
    // 初始化或获取本次 Session 的进店时间
    let arrivalStr = sessionStorage.getItem('endhere_arrival_time')
    if (!arrivalStr) {
      arrivalStr = new Date().toISOString()
      sessionStorage.setItem('endhere_arrival_time', arrivalStr)
    }
    
    // 计算时间差，准备打印机数据
    const arrivalDate = new Date(arrivalStr)
    const hour = arrivalDate.getHours()
    let timePrefix = '白天'
    if (hour < 5) timePrefix = '凌晨'
    else if (hour < 12) timePrefix = '早上'
    else if (hour < 19) timePrefix = '下午'
    else timePrefix = '晚上'
    
    const arrivalText = `${timePrefix}${hour > 12 ? hour - 12 : hour}点`
    const stayMinutes = Math.max(1, Math.floor((Date.now() - arrivalDate.getTime()) / 60000))
    
    setReceiptData({
      arrivalText,
      stayMinutes,
      entriesCount: entries.length
    })

    const fetchInventory = async () => {
      try {
        const { data, error } = await supabase
          .from('iron_basket')
          .select('gift_id, created_at')
          .eq('status', 'available')
          
        const { data: weatherData } = await supabase.from('world_state').select('event_type').eq('id', true).single()
        const isRaining = weatherData?.event_type === 'rain'

        if (data && !error) {
          const now = Date.now()
          const validData = data.filter((item: any) => {
            const itemTime = new Date(item.created_at).getTime()
            return (now - itemTime) <= 72 * 60 * 60 * 1000 
          })

          const counts = validData.reduce((acc: Record<string, number>, item: any) => {
            acc[item.gift_id] = (acc[item.gift_id] || 0) + 1
            return acc
          }, { milk: 0, candy: 0, ice_water: 0, umbrella: 0 }) 
          
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
  }, [mode, receiptId, isManagerMode, entries.length])

  // P3: 三段式物理打印逻辑
  const handlePrintReceipt = () => {
    trackSpaceEvent('EVENT_PRINT_RECEIPT')
    setPrinterState('printing_1')
    setTimeout(() => setPrinterState('printing_2'), 1000)
    setTimeout(() => setPrinterState('printing_3'), 2200)
    setTimeout(() => setPrinterState('done'), 2500)
  }

  // P3: 纯前端 HTML 转图片下线
  const handleSaveReceipt = async () => {
    trackSpaceEvent('EVENT_SAVE_RECEIPT')
    try {
      const html2canvas = (await import('html2canvas')).default
      const node = document.getElementById('receipt-node')
      if (!node) return
      
      const canvas = await html2canvas(node, {
        background: '#050505',
        scale: Math.min(window.devicePixelRatio || 1, 2), // 性能锁
      } as any)
      
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `EndHere_流水单_${Date.now()}.png`
      a.click()
    } catch (e) {
      alert('打印机卡纸了，没有保存成功。')
    }
  }

  // 给店长压小票的极度弱化动作
  const handleLeaveForManager = async () => {
    if (mailboxStatus === 'loading' || mailboxStatus === 'success') return
    setMailboxStatus('loading')
    trackSpaceEvent('EVENT_LEAVE_RECEIPT_HIDDEN', { receiptId })

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

  // 在铁筐里放东西的纯物理反馈动作
  const handleLeaveGift = (gift: any) => {
    trackSpaceEvent('EVENT_PLACE_ITEM_BASKET', { item_id: gift.id })
    setLeftItem(gift.id)
    setTimeout(() => setLeftItem(null), 3000)
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
          <div style={{ padding: '32px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
            <div style={{ textAlign: 'left', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', borderLeft: '2px solid var(--warm-yellow)' }}>
              <p style={{ color: 'var(--warm-yellow)', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>店长留言规则：</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.8' }}>你的意见将被物理留存。店长跑完夜车回来看到后，可能会回复，也可能假装没看见。</p>
            </div>
            
            {/* 弱化后的交互组件 */}
            {mailboxStatus === 'idle' && (
              <span 
                onClick={handleLeaveForManager} 
                style={{ color: '#6b7280', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.1em', transition: 'color 0.3s', borderBottom: '1px dashed transparent', paddingBottom: '2px' }}
                onMouseEnter={e => e.currentTarget.style.color = '#9ca3af'}
                onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
              >
                [ 偷偷压在收银台底下 ]
              </span>
            )}
            {mailboxStatus === 'loading' && <span style={{ color: '#555', fontSize: '11px', letterSpacing: '0.1em' }}>[ 动作很轻... ]</span>}
            {mailboxStatus === 'success' && <span style={{ color: '#555', fontSize: '11px', fontStyle: 'italic', letterSpacing: '0.1em' }}>[ 纸条被压住了。 ]</span>}
            {mailboxStatus === 'error' && <span style={{ color: '#e87070', fontSize: '11px', letterSpacing: '0.1em' }}>[ 被风吹出来了: {mailboxMsg} ]</span>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease-out' }}>
          
          <div style={{ width: '100%', padding: '24px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🧺</span>
              <span style={{ color: 'var(--text-main)', fontSize: '15px', letterSpacing: '0.1em', fontWeight: '500' }}>生锈的铁筐</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.7 }}>
              存放着别人留下的善意。物资会在冰冷的铁筐里静置 24 小时后，才能被下一个人带走。
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>给后半夜来的人留点什么？</p>
              {BASKET_GIFTS.map(gift => (
                <button key={gift.id} onClick={() => handleLeaveGift(gift)} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', transition: 'background 0.3s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{gift.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-main)', fontSize: '12px' }}>{gift.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px', opacity: 0.7 }}>{gift.desc}</span>
                    </div>
                  </div>
                </button>
              ))}
              {leftItem && (
                 <span style={{ color: '#6b7280', fontSize: '11px', textAlign: 'center', marginTop: '8px', fontStyle: 'italic', animation: 'fadeIn 0.5s', letterSpacing: '0.1em' }}>
                   [ 物品安静地放在了铁筐边缘。 ]
                 </span>
              )}
            </div>
          </div>

          {/* ================= P3: 底部结算打印机 ================= */}
          <div style={{ width: '100%', padding: '32px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            
            {printerState === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#747477', fontSize: '11px', letterSpacing: '0.1em' }}>[ 吧台边缘有一台老旧的小票打印机。 ]</span>
                <span
                  onClick={handlePrintReceipt}
                  style={{ color: '#8a8277', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '4px', transition: 'color 0.2s', marginTop: '8px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#9ca3af'}
                  onMouseLeave={e => e.currentTarget.style.color = '#8a8277'}
                >
                  {'> 扯一张今天的流水单'}
                </span>
              </div>
            )}

            {(printerState === 'printing_1' || printerState === 'printing_2' || printerState === 'printing_3') && (
              <div style={{ color: '#8a8277', fontSize: '11px', letterSpacing: '0.15em', fontFamily: 'monospace', textAlign: 'center', height: '20px' }}>
                {printerState === 'printing_1' && '[ 机器通电... ]'}
                {printerState === 'printing_2' && '滋——————'}
                {printerState === 'printing_3' && '咔哒。'}
              </div>
            )}

            {printerState === 'done' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', alignItems: 'center', animation: 'fadeIn 0.5s ease' }}>
                
                {/* 小票本体：用于截图的绝对干净节点 */}
                <div id="receipt-node" style={{ width: '100%', maxWidth: '280px', background: '#050505', padding: '32px 24px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ paddingBottom: '16px', borderBottom: '1px dashed rgba(255,255,255,0.2)', marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{ color: '#e5e7eb', fontSize: '16px', letterSpacing: '0.15em', fontWeight: 'bold' }}>END HERE</div>
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px', letterSpacing: '0.1em' }}>断网巷 404 号</div>
                  </div>
                  
                  <div style={{ color: '#d1d5db', fontSize: '12px', lineHeight: '2.6', letterSpacing: '0.1em', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>{receiptData.arrivalText}进店。</div>
                    <div>发呆 {receiptData.stayMinutes} 分钟。</div>
                    {receiptData.entriesCount > 0 ? (
                      <div>留下了 {receiptData.entriesCount} 句话。</div>
                    ) : (
                      <div>什么也没写。</div>
                    )}
                  </div>

                  <div style={{ paddingTop: '20px', borderTop: '1px dashed rgba(255,255,255,0.2)', marginTop: '20px', textAlign: 'center' }}>
                    <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '0.15em' }}>* 离店概不负责 *</div>
                  </div>
                </div>

                <span
                  onClick={handleSaveReceipt}
                  style={{ color: '#8a8277', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '4px', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#9ca3af'}
                  onMouseLeave={e => e.currentTarget.style.color = '#8a8277'}
                >
                  {'> 把小票揣进口袋'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
        <button onClick={() => router.push('/')} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.8 }}>离开收银台</button>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

export default function CounterPage() {
  return <Suspense><CounterContent /></Suspense>
}