import React, { useEffect, useState } from 'react';

export interface ReceiptData {
  receiptId: string;
  timestamp: number;
  user_message?: string;
  ai_name?: string;
  ai_reply?: string;
  manager_reply?: string | null;
  behavior_stats?: {
    watering_count: number;
    stool_moved_count: number;
    stay_duration: number;
  };
}

export interface ReceiptProps {
  data: ReceiptData;
  type: 'behavior' | 'memo'; 
  status: 'normal' | 'destroyed'; 
}

const ReceiptRow = ({ label, value }: { label: string, value: string | number }) => (
  <div className="flex items-baseline w-full mb-2">
    <span className="shrink-0 font-medium text-zinc-600">{label}</span>
    <div className="grow border-b-[1.5px] border-dotted border-zinc-800/50 mx-2 relative -top-1" />
    <span className="shrink-0 font-medium text-zinc-400">{value}</span>
  </div>
);

export function Receipt({ data, type, status }: ReceiptProps) {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const focusTimer = setTimeout(() => setIsFocused(true), 50);
    return () => clearTimeout(focusTimer);
  }, []);

  const calculateWeathering = () => {
    if (type !== 'memo') return 'opacity-100'; 
    const daysOld = Math.max(0, (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24));
    
    if (daysOld <= 1) return 'opacity-100 text-zinc-300';
    if (daysOld > 1 && daysOld <= 5) return 'opacity-80 text-zinc-400 font-light';
    return 'opacity-50 text-zinc-500 font-thin'; 
  };

  const weatherClass = calculateWeathering();
  const visualFocusClass = isFocused ? 'blur-none opacity-100' : 'blur-sm opacity-0';
  const destructionClass = status === 'destroyed' ? 'line-through opacity-30 grayscale' : '';

  return (
    <div 
      id={`receipt-${data.receiptId}`}
      // 核心修复：强制类名规范，铲除所有锯齿逻辑
      className={`relative w-full max-w-sm mx-auto p-8 border-y border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-500 font-mono transition-all duration-1000 ease-out box-border ${visualFocusClass} ${destructionClass}`}
    >
      
      {/* ==================== 小票头部 ==================== */}
      <div className="text-center tracking-wider mb-5 w-full">
        <div className="text-[13px] tracking-[0.1em] font-bold text-zinc-600 mb-3">
          [ END HERE 终端 ]
        </div>
        <div className="border-b border-dashed border-zinc-800/50 my-3" />
        <div className="text-left text-[11px] text-zinc-500 flex flex-col gap-1 font-medium w-full uppercase tracking-widest">
          <div>TICKET: {data.receiptId}</div>
          <div>DATE: {new Date(data.timestamp).toLocaleDateString()} {new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
      </div>

      <div className="border-b border-dashed border-zinc-800/50 mb-5" />

      {/* ==================== 动态分发主体 ==================== */}
      <div className="flex-grow flex flex-col justify-start mt-1 w-full">
        {type === 'behavior' && data.behavior_stats ? (
          <div className="text-[13px] flex flex-col gap-2 font-semibold text-zinc-400 w-full mb-4">
            <ReceiptRow label="进店时长" value={`${data.behavior_stats.stay_duration} 分钟`} />
            <ReceiptRow label="木凳落座" value={`${data.behavior_stats.stool_moved_count} 次`} />
            <ReceiptRow label="浇灌植物" value={`${data.behavior_stats.watering_count} 次`} />
          </div>
        ) : (
          <div 
            className={`w-full text-[14px] leading-relaxed whitespace-pre-wrap transition-colors break-words ${weatherClass}`}
          >
            {data.user_message || '...'}
          </div>
        )}

        {/* ==================== 底部回复解耦区 ==================== */}
        {type === 'memo' && (
          <div className="mt-8 pt-6 border-t border-dashed border-zinc-800/50 space-y-4">
            
            {/* 场景 1：AI 的即时回复 */}
            {data.ai_reply && (
              <div className="text-zinc-400 text-sm leading-relaxed">
                <span className="text-zinc-600 mr-2">[ {data.ai_name || 'ASH'} ]:</span>
                {data.ai_reply}
              </div>
            )}

            {/* 场景 2 & 3：店长的异步回复 */}
            {data.manager_reply ? (
              // 已回复：使用暗琥珀色
              <div className="text-amber-700/80 text-sm leading-relaxed">
                <span className="text-amber-900/60 mr-2">[ 店长批注 ]:</span>
                {data.manager_reply}
              </div>
            ) : (
              // 未回复：极暗的占位符
              <div className="text-zinc-700/50 text-xs italic">
                [ 留白。等待店长批注... ]
              </div>
            )}

          </div>
        )}
      </div>

      {/* ==================== 底部免责声明 ==================== */}
      <div className="border-t border-dashed border-zinc-800/50 pt-4 text-center mt-8 w-full">
        <div className="text-[10px] tracking-[0.2em] text-zinc-700 font-bold opacity-70">
          * 离店概不负责 *
        </div>
      </div>
    </div>
  );
}