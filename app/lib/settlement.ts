import { useWorldEngine } from '../store/useWorldEngine';
import { useEntityStore } from '../store/useEntityStore';

export const settleTimeLapse = (elapsedHours: number, currentSlice: string) => {
  // 强制类型断言，解决 TS 对 Zustand 外部调用 getState() 的误判
  const worldEngine = useWorldEngine as any;
  const entityStore = useEntityStore as any;

  const mutateWorld = worldEngine.getState().mutateWorld;
  const state = entityStore.getState();

  // 1. 物理衰减：每流逝 1 小时，植物健康值 -5%
  const healthDecay = elapsedHours * 5;
  
  // 【修复 3 & 4】将参数合并为单个 Action 对象
  mutateWorld({ 
    action: 'decay_plant', 
    payload: { amount: healthDecay } 
  });

  // 2. 无常降临：深夜概率注入
  // 【修复 2】从 state.entities 数组或对象中判断吧台是否有物品
  // 假设你的物品存储逻辑是 entities 数组或类似结构，这里用更严谨的判断
  const isBarEmpty = !state.entities?.some((e: any) => e.location === 'bar_counter');

  if (currentSlice === 'DEEP_NIGHT' && isBarEmpty) {
    if (Math.random() < 0.1) {
      // 【修复 3 & 4】合并为单参数
      mutateWorld({
        action: 'inject_item',
        payload: { 
          item_id: 'mint', 
          target: 'bar_counter',
          metadata: { source: 'night_wanderer' } 
        }
      });
    }
  }
};