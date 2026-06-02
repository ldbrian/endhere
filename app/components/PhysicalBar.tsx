// components/PhysicalBar.tsx
import { useEffect, useState } from 'react';
import { useEntityStore } from '../store/useEntityStore';
import { useWorldEngine } from '../store/useWorldEngine';
import { trackSpaceEvent } from '../lib/telemetry';

export function PhysicalBar() {
  const barCounter = useEntityStore(state => state.bar_counter);
  const mutateWorld = useWorldEngine(state => state.mutateWorld);
  const [pendingItems, setPendingItems] = useState<any[]>([]);

  // 轮询或事件监听 Session 中的待结账物品
  useEffect(() => {
    const checkPending = () => {
      const items = JSON.parse(sessionStorage.getItem('endhere_pending_items') || '[]');
      setPendingItems(items);
    };
    checkPending();
    window.addEventListener('focus', checkPending); // 简单回归焦点刷新
    return () => window.removeEventListener('focus', checkPending);
  }, []);

  const handleEatMint = () => {
    trackSpaceEvent('EVENT_EAT_MINT');
    mutateWorld({ action: 'remove_item', payload: { target: 'bar_counter' } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
      {/* 渲染未结账的遗留物 */}
      {pendingItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {pendingItems.map((item, idx) => (
            <span key={idx} style={{ color: '#a89f91', fontSize: '11px' }}>
              [ 吧台边缘放着一份 {item.name}。还没人替它结账。 ]
            </span>
          ))}
        </div>
      )}

      {/* 渲染 Phase 2 引擎注入的 Tier 2 物品 */}
      {barCounter?.item_id === 'mint' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '2px solid #78716c', paddingLeft: '8px' }}>
          <span style={{ color: '#8a8277', fontSize: '10px', letterSpacing: '0.1em' }}>
            [ 吧台阴影里有一颗包装简陋的硬薄荷糖。 ]
          </span>
          <span
            onClick={handleEatMint}
            style={{ color: '#d1d5db', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '4px' }}
          >
            → 剥开吃掉
          </span>
        </div>
      )}
    </div>
  );
}