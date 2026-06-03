import { useWorldEngine } from '../store/useWorldEngine';
import { useEntityStore } from '../store/useEntityStore';
import { calculateTimeSlice } from './time';

/**
 * 核心引擎：空间惰性结算 (Lazy Settlement Engine)
 * @param lastVisitedAt 玩家上一次离开/失去焦点的时间戳
 */
export const settleWorldState = (lastVisitedAt: number) => {
  if (!lastVisitedAt) return;

  const now = Date.now();
  const elapsedHours = (now - lastVisitedAt) / (1000 * 60 * 60);

  // 极其微小的时间差不触发结算（防抖与防刷）
  if (elapsedHours < 0.05) return;

  const currentSlice = calculateTimeSlice(new Date(now));
  const lastSlice = calculateTimeSlice(new Date(lastVisitedAt));

  // 穿透获取底层引擎状态（不触发组件 Re-render 造成性能损耗）
  const worldEngine = useWorldEngine.getState();
  const entityStore = useEntityStore.getState();
  const mutateWorld = worldEngine.mutateWorld;

  // ==========================================
  // [保留] 旧版优秀逻辑：时间流逝带来的物理植物衰败
  // ==========================================
  if (elapsedHours >= 1) {
    const healthDecay = elapsedHours * 5;
    mutateWorld({
      action: 'decay_plant',
      payload: { amount: healthDecay }
    });
  }

  // ==========================================
  // [重构] Phase 9 惰性结算引擎 (Lazy Settlement)
  // ==========================================
  // 物理原则：如果吧台已经有东西了，绝不发生空间重叠覆盖
  const isBarEmpty = !entityStore.bar_counter;
  if (!isBarEmpty) return;

  let hasMint = false;
  let hasOrange = false;

  // 法则 1: 跨越切片且当前为深夜 (02:00-05:00)，15% 概率
  if (currentSlice === 'DEEP_NIGHT' && currentSlice !== lastSlice) {
    if (Math.random() <= 0.15) hasMint = true;
  }

  // 法则 2: 距离上次访问超过 4 小时，5% 概率
  if (elapsedHours >= 4 && !hasMint) {
    if (Math.random() <= 0.05) hasOrange = true;
  }

  // 结算执行 (下发给物理引擎持久化)
  if (hasMint) {
    mutateWorld({
      action: 'inject_item',
      payload: { item_id: 'mint', target: 'bar_counter', metadata: { source: 'night_wanderer' } }
    });
  } else if (hasOrange) {
    mutateWorld({
      action: 'inject_item',
      payload: { item_id: 'orange', target: 'bar_counter', metadata: { source: 'time_lapse' } }
    });
  }
};