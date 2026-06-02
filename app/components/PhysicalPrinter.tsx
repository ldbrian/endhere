// components/PhysicalPrinter.tsx
import { useState, useEffect } from 'react';
import { trackSpaceEvent } from '../lib/telemetry';

export function PhysicalPrinter() {
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [checkoutState, setCheckoutState] = useState<'idle' | 'paying' | 'done'>('idle');

  useEffect(() => {
    setPendingItems(JSON.parse(sessionStorage.getItem('endhere_pending_items') || '[]'));
  }, []);

  const handlePay = async () => {
    setCheckoutState('paying');
    trackSpaceEvent('EVENT_CHECKOUT_INIT');
    
    try {
      // 唯一入库点：真正写入数据库
      await fetch('/api/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: pendingItems })
      });
      
      // 清空 Session
      sessionStorage.removeItem('endhere_pending_items');
      setPendingItems([]);
      setCheckoutState('done');
      trackSpaceEvent('EVENT_CHECKOUT_SUCCESS');
      
      // 触发小票打印机状态机 (略过具体动画代码，沿用已有的打印逻辑)
      // triggerPrintAnimation(); 
    } catch (e) {
      alert('网络断了，钱没放稳。');
      setCheckoutState('idle');
    }
  };

  return (
    <div style={{ width: '100%', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
      
      {/* 待结账区域：若有物品则要求结账 */}
      {pendingItems.length > 0 && checkoutState !== 'done' && (
        <div style={{ width: '288px', background: '#1a1612', padding: '16px', border: '1px dashed #3f3f46', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ color: '#a89f91', fontSize: '11px', textAlign: 'center' }}>
            -- 待结账清单 --
          </div>
          {pendingItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', fontSize: '11px', fontFamily: 'monospace' }}>
              <span>{item.name}</span>
              <span>.................. 随意</span>
            </div>
          ))}
          
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
             <img src="/pay_code.png" alt="赞赏码" style={{ width: '100px', height: '100px', opacity: 0.7, filter: 'grayscale(100%)' }} />
             <button 
               onClick={handlePay} 
               disabled={checkoutState === 'paying'}
               style={{ background: 'transparent', border: '1px solid #78716c', color: '#d1d5db', padding: '8px 16px', fontSize: '10px', cursor: 'pointer', fontFamily: 'monospace' }}
             >
               {checkoutState === 'paying' ? '硬币滚落中...' : '> 钱压在玻璃板下了'}
             </button>
          </div>
        </div>
      )}

      {/* 打印机空转或出票入口 */}
      {pendingItems.length === 0 && checkoutState !== 'paying' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#747477', fontSize: '10px', letterSpacing: '0.1em' }}>[ 吧台边缘有一台老旧的小票打印机。 ]</span>
          <span
            onClick={() => {/* 触发常规流水单打印 */}}
            style={{ color: '#8a8277', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '4px' }}
          >
            {'> 扯一张今天的流水单'}
          </span>
        </div>
      )}
    </div>
  );
}