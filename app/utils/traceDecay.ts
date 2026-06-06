import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Shanghai");

export interface TraceDecayResult {
  style: string;
  text: string;
  isVisible: boolean;
  canInteract: boolean;
}

export function getTraceStyleAndText(traceText: string, createdAt: number | string, entityType: 'stool' | 'wall' | 'plant' | 'basket'): TraceDecayResult {
  const now = dayjs().tz("Asia/Shanghai");
  const traceTime = dayjs(createdAt).tz("Asia/Shanghai");
  const diffHours = now.diff(traceTime, 'hour', true);

  // 默认值：确保所有返回对象都拥有相同的 Key
  const defaults = { isVisible: true, canInteract: false };

  if (entityType === 'stool') {
    if (diffHours < 1) return { ...defaults, style: "text-[#b0a080]/90 transition-colors", text: "木凳边缘还有一点余温。" };
    if (diffHours < 12) return { ...defaults, style: "text-zinc-400/70 transition-colors", text: "角落里的木凳似乎被占用过。" };
    return { ...defaults, style: "text-zinc-600/50 transition-colors", text: "一张落了灰的破木凳。" };
  }

  if (entityType === 'wall') {
    if (diffHours < 12) return { ...defaults, style: "text-zinc-400", text: traceText };
    if (diffHours < 48) return { ...defaults, style: "text-zinc-500", text: traceText };
    return { ...defaults, style: "text-zinc-600 opacity-40 font-thin italic", text: "墙角有一块模糊的涂鸦痕迹" };
  }

  if (entityType === 'plant') {
    if (diffHours < 24) return { ...defaults, style: "text-zinc-400", text: "角落里的一盆植物，泥土还是湿润的。", canInteract: false };
    if (diffHours < 72) return { ...defaults, style: "text-zinc-500", text: "植物的叶子有些发黄，泥土干裂。", canInteract: true };
    return { ...defaults, style: "text-zinc-600 opacity-50 font-thin line-through", text: "一盆已经枯死的植物残骸。", canInteract: true };
  }

  if (entityType === 'basket') {
    // 逻辑隐藏时，依然返回结构化对象，只是标记 isVisible: false
    if (diffHours < 24 || diffHours >= 72) return { ...defaults, isVisible: false, style: "", text: "" };
    return { ...defaults, isVisible: true, style: "text-zinc-400", text: `${traceText}，没人拿走` };
  }

  return { ...defaults, style: "text-zinc-600", text: traceText };
}