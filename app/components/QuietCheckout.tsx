// components/QuietCheckout.tsx
import { useState } from 'react';
import { trackSpaceEvent } from '../lib/telemetry';

export function QuietCheckout({ receiptId }: { receiptId: string }) {
  const [isHidden, setIsHidden] = useState(false);

  const handleLeaveForManager = async () => {
    // 物理动作阻断，防止重复点击
    if (isHidden) return;
    setIsHidden(true);
    trackSpaceEvent('EVENT_LEAVE_RECEIPT_HIDDEN', { receiptId });

    try {
      // 纯粹的遗留记录逻辑，无任何支付校验
      await fetch('/api/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, action: 'slip_under_counter' })
      });
    } catch (e) {
      // 保持沉默，不需要弹窗报错打扰环境
      console.warn('Action failed silently');
    }
  };

  if (isHidden) {
    return (
      <div className="w-full mt-16 text-center animate-[fadeIn_1s_ease-out]">
        <span className="text-[10px] text-neutral-600 italic tracking-widest">
          [ 纸条被压住了。 ]
        </span>
      </div>
    );
  }

  return (
    <div className="w-full mt-16 flex flex-col items-center">
      <span 
        onClick={handleLeaveForManager}
        className="text-[11px] text-neutral-600 hover:text-neutral-400 cursor-pointer transition-colors duration-500 border-b border-dashed border-transparent hover:border-neutral-500 pb-1 tracking-[0.1em]"
      >
        [ 偷偷压在收银台底下 ]
      </span>
    </div>
  );
}