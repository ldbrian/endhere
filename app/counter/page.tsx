'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { track } from '../lib/track'

function CounterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // 从 URL 获取上一页传过来的参数
  const receiptId = searchParams.get('receiptId') || ''
  const mode = searchParams.get('mode') || 'ai' // 'manager' 或 'ai'
  const isManagerMode = mode === 'manager'

  const [inputCode, setInputCode] = useState('')
  const [mailboxStatus, setMailboxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [mailboxMsg, setMailboxMsg] = useState('')
  const [showCandyJar, setShowCandyJar] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    track('view_counter', { mode, receipt_id: receiptId })
    setTimeout(() => setVisible(true), 100)
    // 如果是店长模式，默认直接展开糖罐
    if (isManagerMode) setShowCandyJar(true)
  }, [mode, receiptId, isManagerMode])

  const handleLeaveForManager = async () => {
    if (mailboxStatus === 'loading' || mailboxStatus === 'success') return
    setMailboxStatus('loading')
    
    try {
      const entries = JSON.parse(localStorage.getItem('entries') || '[]')
      const currentEntry = entries[0]
      const userContent = currentEntry?.content || currentEntry?.text || '无言的投递...'
      const aiContent = currentEntry?.rawResponse || '【系统提示】：用户选择了直接留言给店长。'

      const res = await fetch('/api/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, userMessage: userContent, aiResponse: aiContent })
      })
      const data = await res.json()
      
      if (data.success) {
        setMailboxStatus('success')
        setMailboxMsg(data.message)
        track('manager_mailbox_success', { receipt_id: receiptId })
      } else {
        setMailboxStatus('error')
        setMailboxMsg(data.message)
      }
    } catch (e) {
      setMailboxStatus('error')
      setMailboxMsg('吧台抽屉卡住了，请稍后再试。')
    }
  }

  const handleActivateCode = () => {
    const cleanCode = inputCode.trim().toUpperCase()
    if (!cleanCode) return
    if (cleanCode === receiptId) {
      localStorage.setItem('extra_limit_granted', '3') 
      alert('📻 破收音机换上了新电池。今晚你多出了 3 次倾诉额度。去首页试试吧。')
      track('activate_battery', { receipt_id: receiptId })
      setInputCode('')
      router.push('/')
    } else if (cleanCode === 'FOREVER2026') {
      localStorage.setItem('is_lifetime_vip', 'true')
      alert('🔑 你拿到了一把不会生锈的备用钥匙。这里永远为你留一盏灯。')
      track('activate_vip')
      setInputCode('')
      router.push('/')
    } else {
      alert('❓ 暗号对不上。如果你刚刚转账，请私信店长获取核销码。')
    }
  }

  return (
    <div style={{
      width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column',
      gap: '24px', padding: '60px 20px', margin: '0 auto',
      opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease',
    }}>

      {/* 顶部指示 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center', marginBottom: '8px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.3em' }}>
          END HERE COUNTER
        </p>
        <h1 style={{ color: 'var(--text-main)', fontSize: '24px', fontWeight: '300', letterSpacing: '0.15em' }}>
          午夜收银台
        </h1>
        <p style={{ color: 'var(--warm-yellow)', fontFamily: 'monospace', fontSize: '12px', opacity: 0.8, letterSpacing: '0.05em' }}>
          当前拿着的小票暗号: #{receiptId}
        </p>
      </div>

      {/* === 店长模式：专属的玻璃糖罐 === */}
      {isManagerMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.4s ease-out' }}>
          <div style={{ padding: '24px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <div style={{ textAlign: 'left', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', borderLeft: '2px solid var(--warm-yellow)' }}>
              <p style={{ color: 'var(--warm-yellow)', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.1em' }}>
                【吧台规矩】
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.8' }}>
                1. 吧台每天<span style={{ color: 'var(--text-main)' }}>只收 7 张小票</span>，满了店长就收车。<br/>
                2. 留一瓶水的钱 (￥4.9) 当作提神费。<br/>
                3. <span style={{ color: 'var(--text-main)' }}>不承诺一定回，不退款。</span>看缘分。
              </p>
            </div>
            
            <img src="/pay_code.png" alt="投币码" style={{ width: '160px', height: '160px', filter: 'grayscale(100%) contrast(1.2)', opacity: 0.85, borderRadius: '8px' }} />
            
            <button
              onClick={handleLeaveForManager}
              disabled={mailboxStatus !== 'idle'}
              style={{
                width: '100%', padding: '16px', borderRadius: '8px', 
                background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)',
                color: 'var(--warm-yellow)', fontSize: '14px', cursor: mailboxStatus === 'success' ? 'default' : 'pointer',
                fontWeight: 'bold', letterSpacing: '0.1em', transition: 'all 0.3s ease'
              }}
            >
              {mailboxStatus === 'idle' && '已塞入 ￥4.9，压下小票'}
              {mailboxStatus === 'loading' && '正在压入小票...'}
              {mailboxStatus === 'success' && '卷帘门正在拉下，去睡吧。'}
              {mailboxStatus === 'error' && '❌ ' + mailboxMsg}
            </button>
          </div>
        </div>
      ) : (
        /* === AI 模式下的货架 === */
        <div style={{ 
          width: '100%', padding: '24px 20px', borderRadius: '12px', 
          background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', 
          textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.4s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🪟</span>
            <span style={{ color: 'var(--text-main)', fontSize: '15px', letterSpacing: '0.1em', fontWeight: '500' }}>吧台旁的旧货架</span>
          </div>
          
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', opacity: 0.8 }}>
            这家破店没有投资人。如果你愿意，可以留一点电费，支持它在深夜继续亮着。转账时请务必备注你的小票暗号：<span style={{ color: 'var(--warm-yellow)' }}>#{receiptId}</span>。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 电池商品 */}
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-main)', fontSize: '14px' }}>🔋 收音机电池</span>
                <span style={{ color: 'var(--warm-yellow)', fontSize: '14px' }}>￥4.9</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.6, lineHeight: '1.6' }}>扫码支付，下方输入暗号激活，获取今晚额外 3 次倾诉额度。</p>
            </div>

            {/* 钥匙商品 */}
            <div style={{ padding: '14px', background: 'rgba(245,200,66,0.05)', borderRadius: '8px', border: '1px dashed rgba(245,200,66,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--warm-yellow)', fontSize: '14px', fontWeight: 'bold' }}>🔑 备用钥匙 (买断)</span>
                <span style={{ color: 'var(--warm-yellow)', fontSize: '14px', fontWeight: 'bold' }}>￥39.9</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', opacity: 0.8, lineHeight: '1.6' }}>扫码支付，带截图即刻私信店长换取核销码，获取终身无限访问权。</p>
            </div>
          </div>

          {/* 收款与激活区 */}
          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <img src="/pay_code.png" alt="投币码" style={{ width: '140px', height: '140px', filter: 'grayscale(100%) contrast(1.2)', opacity: 0.85, borderRadius: '8px' }} />
            
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder={`在此处输入流水号或暗号...`}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '13px', outline: 'none' }}
              />
              <button 
                onClick={handleActivateCode} 
                style={{ padding: '0 20px', borderRadius: '8px', background: 'var(--warm-yellow)', color: '#121212', fontSize: '14px', fontWeight: 'bold' }}
              >
                激活
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部导航 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
        <button 
          onClick={() => router.push('/archive')} 
          style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', fontSize: '13px', letterSpacing: '0.15em', cursor: 'pointer', opacity: 0.8 }}
        >
          去看我的情绪档案
        </button>
        <button 
          onClick={() => router.push('/')} 
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', opacity: 0.5, letterSpacing: '0.1em', marginTop: '8px' }}
        >
          回到店外
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default function CounterPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--text-muted)' }}>走向收银台...</div>}>
      <CounterContent />
    </Suspense>
  )
}