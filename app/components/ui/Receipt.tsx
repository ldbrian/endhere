import React, { useEffect, useState } from 'react';

// ============================================================================
// 严格的契约声明：只读数据，杜绝一切全局状态注入
// ============================================================================
export interface ReceiptData {
  receiptId: string;
  timestamp: number;
  user_message?: string;
  manager_message?: string | null;
  behavior_stats?: {
    watering_count: number;
    stool_moved_count: number;
    stay_duration: number;
  };
}

export interface ReceiptProps {
  data: ReceiptData;
  type: 'behavior' | 'memo'; // behavior: 首页行为分享票; memo: 文字留言小票
  status: 'normal' | 'destroyed'; // normal: 正常状态; destroyed: 销毁页面的特殊样式
}

// ============================================================================
// SVG 素材组件化
// ============================================================================
const TopJaggedSVG = () => (
  <svg width="100%" height="8" viewBox="0 0 288 8" preserveAspectRatio="none" className="block">
    <polygon points="0,8 6,0 12,8 18,0 24,8 30,0 36,8 42,0 48,8 54,0 60,8 66,0 72,8 78,0 84,8 90,0 96,8 102,0 108,8 114,0 120,8 126,0 132,8 138,0 144,8 150,0 156,8 162,0 168,8 174,0 180,8 186,0 192,8 198,0 204,8 210,0 216,8 222,0 228,8 234,0 240,8 246,0 252,8 258,0 264,8 270,0 276,8 282,0 288,8" fill="#b5b0a1" />
  </svg>
);

const BottomJaggedSVG = () => (
  <svg width="100%" height="8" viewBox="0 0 288 8" preserveAspectRatio="none" className="block">
    <polygon points="0,0 6,8 12,0 18,8 24,0 30,8 36,0 42,8 48,0 54,8 60,0 66,8 72,0 78,8 84,0 90,8 96,0 102,8 108,0 114,8 120,0 126,8 132,0 138,8 144,0 150,8 156,0 162,8 168,0 174,8 180,0 186,8 192,0 198,8 204,0 210,8 216,0 222,8 228,0 234,8 240,0 246,8 252,0 258,8 264,0 270,8 276,0 282,8 288,0" fill="#b5b0a1" />
  </svg>
);

const ReceiptRow = ({ label, value }: { label: string, value: string | number }) => (
  <div className="flex items-baseline w-full mb-1">
    <span className="shrink-0 font-semibold">{label}</span>
    <div className="grow border-b-2 border-dotted border-[#78716c] mx-2 relative -top-1 opacity-60" />
    <span className="shrink-0 font-semibold">{value}</span>
  </div>
);

// ============================================================================
// 核心 Receipt 组件实装
// ============================================================================
export function Receipt({ data, type, status }: ReceiptProps) {
  const [isFocused, setIsFocused] = useState(false);

  // 动效一：眼睛聚焦。挂载后微延时触发，确保浏览器完整计算前置样式
  useEffect(() => {
    const focusTimer = setTimeout(() => setIsFocused(true), 50);
    return () => clearTimeout(focusTimer);
  }, []);

  // 动效二：物理时间风化算法计算
  const calculateWeathering = () => {
    if (type !== 'memo') return 'font-normal text-zinc-800'; // 行为票保持清晰

    const daysOld = Math.max(0, (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24));
    
    if (daysOld <= 1) return 'font-normal text-zinc-800';
    if (daysOld > 1 && daysOld <= 5) return 'font-light text-zinc-600';
    return 'font-thin text-zinc-800 opacity-40'; // 大于 5 天：极致字重衰减与透写
  };

  const weatherClass = calculateWeathering();
  
  // 视网膜聚焦与销毁状态样式映射
  const visualFocusClass = isFocused ? 'blur-none opacity-100' : 'blur-sm opacity-50';
  const destructionClass = status === 'destroyed' ? 'line-through opacity-40 grayscale' : '';

  return (
    <div className={`w-[288px] flex flex-col font-mono relative select-none transition-all duration-1000 ease-out ${visualFocusClass} ${destructionClass}`}>
      <TopJaggedSVG />
      
      <div className="bg-[#b5b0a1] text-[#1a1612] px-5 py-4 flex flex-col">
        {/* 小票头部 (Header) */}
        <div className="text-center text-xs tracking-wider font-bold">
          <div className="text-sm font-bold text-[#1a1612]">[ END HERE 终端 ]</div>
          <div className="border-b-2 border-dashed border-[#78716c] my-3" />
          <div className="text-left text-[11px] text-[#44403c] flex flex-col gap-1 font-semibold">
            <div>TICKET: {data.receiptId}</div>
            <div>DATE: {new Date(data.timestamp).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="border-b-2 border-dashed border-[#78716c] my-3" />

        {/* 动态分发主体 (Content) */}
        {type === 'behavior' && data.behavior_stats ? (
          <div className="text-xs flex flex-col gap-1.5 font-semibold text-[#1a1612]">
            <ReceiptRow label="进店时长" value={`${data.behavior_stats.stay_duration} 分钟`} />
            <ReceiptRow label="木凳落座" value={`${data.behavior_stats.stool_moved_count} 次`} />
            <ReceiptRow label="浇灌植物" value={`${data.behavior_stats.watering_count} 次`} />
          </div>
        ) : (
          <div className={`text-xs leading-relaxed break-all py-1 whitespace-pre-wrap transition-colors ${weatherClass}`}>
            {data.user_message}
          </div>
        )}

        {/* 附加块：店长留言 (Phase 6 兼容) */}
        {data.manager_message && data.manager_message.trim() !== '' && (
          <div className="text-[11px] text-amber-600/70 mt-4 pt-3 border-t border-dashed border-[#78716c] leading-normal break-all font-semibold whitespace-pre-wrap">
            ------------------------<br />
            [ 店长随手落下的字条："{data.manager_message}" ]
          </div>
        )}

        {/* 底部免责声明 (Footer) */}
        <div className="border-t-2 border-dashed border-[#78716c] pt-3 mt-4 text-center">
          <div className="text-[11px] tracking-widest text-[#44403c] font-bold">* 离店概不负责 *</div>
        </div>
      </div>

      <BottomJaggedSVG />
    </div>
  );
}