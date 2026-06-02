// components/PhysicalBasket.tsx
import { useState } from 'react';
import { trackSpaceEvent } from '../lib/telemetry';

const BASKET_GIFTS = [
  { id: 'milk', name: '温牛奶', icon: '🥛' },
  { id: 'ice_water', name: '冰水', icon: '🧊' },
  { id: 'candy', name: '水果糖', icon: '🍬' },
];

export function PhysicalBasket() {
  const [placedItem, setPlacedItem] = useState<string | null>(null);

  const handlePlaceItem = (gift: any) => {
    // 仅写入临时 Session，绝不发起网络请求
    const pending = JSON.parse(sessionStorage.getItem('endhere_pending_items') || '[]');
    pending.push(gift);
    sessionStorage.setItem('endhere_pending_items', JSON.stringify(pending));
    
    setPlacedItem(gift.id);
    trackSpaceEvent('EVENT_PLACE_ITEM_BASKET', { item: gift.id });
    
    // 物理反馈，延迟重置
    setTimeout(() => setPlacedItem(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px' }}>
      <div style={{ color: '#8a8277', fontSize: '11px', letterSpacing: '0.1em' }}>[ 生锈的铁筐 ]</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {BASKET_GIFTS.map(gift => (
          <button
            key={gift.id}
            onClick={() => handlePlaceItem(gift)}
            style={{ textAlign: 'left', background: 'transparent', border: '1px dashed #3f3f46', padding: '12px', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}
          >
            → 留下一份 {gift.name}
          </button>
        ))}
      </div>

      {placedItem && (
        <div style={{ color: '#6b7280', fontSize: '10px', fontStyle: 'italic', animation: 'fadeIn 0.5s' }}>
          [ 物品暂时放在了铁筐边缘。 ]
        </div>
      )}
    </div>
  );
}