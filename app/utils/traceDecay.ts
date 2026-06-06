import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Shanghai");

export function getTraceStyleAndText(traceText: string, createdAt: number | string, entityType: 'stool' | 'wall' | 'plant' | 'basket') {
  const now = dayjs().tz("Asia/Shanghai");
  const traceTime = dayjs(createdAt).tz("Asia/Shanghai");
  const diffHours = now.diff(traceTime, 'hour', true);

  if (entityType === 'stool') {
    if (diffHours < 1) return { style: "text-[#b0a080]/90 transition-colors", text: "木凳边缘还有一点余温。" };
    if (diffHours < 12) return { style: "text-zinc-400/70 transition-colors", text: "角落里的木凳似乎被占用过。" };
    // 💡 提升了底线亮度：从 700/20 提升到 600/50
    return { style: "text-zinc-600/50 transition-colors", text: "一张落了灰的破木凳。" };
  }

  if (entityType === 'wall') {
    if (diffHours < 12) return { style: "text-zinc-400", text: traceText };
    if (diffHours < 48) return { style: "text-zinc-500", text: traceText };
    // 💡 提升了底线亮度：从 700 opacity-30 提升到 600 opacity-40
    return { style: "text-zinc-600 opacity-40 font-thin italic", text: "墙角有一块模糊的涂鸦痕迹" };
  }

  if (entityType === 'plant') {
    if (diffHours < 24) return { style: "text-zinc-400", text: "角落里的一盆植物，泥土还是湿润的。", canInteract: false };
    if (diffHours < 72) return { style: "text-zinc-500", text: "植物的叶子有些发黄，泥土干裂。", canInteract: true };
    // 💡 提升了底线亮度：从 700 提升到 600
    return { style: "text-zinc-600 opacity-50 font-thin line-through", text: "一盆已经枯死的植物残骸。", canInteract: true };
  }

  if (entityType === 'basket') {
    if (diffHours < 24 || diffHours >= 72) return { isVisible: false, text: "" };
    return { isVisible: true, style: "text-zinc-400", text: `${traceText}，没人拿走` };
  }

  return { style: "text-zinc-600", text: traceText };
}