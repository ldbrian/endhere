'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpaceStore } from '../../store/useSpaceStore';
import { createClient } from '@supabase/supabase-js';
import { getTraceStyleAndText } from '../../utils/traceDecay';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 🎨 CDO 规范：强制涂鸦安全区，绝对禁止侵占中轴线，消除随机数带来的跳动
const GRAFFITI_SAFE_ZONES = [
  { top: '20%', left: '15%' }, // 左上
  { top: '30%', left: '75%' }, // 右上
  { top: '75%', left: '20%' }, // 左下
  { top: '65%', left: '70%' }, // 右下
  { top: '45%', left: '10%' }, // 正左边缘
];

export default function RoamingArea() {
  const [mounted, setMounted] = useState(false);
  const lang = useLanguage();
  const setScene = useSpaceStore((state) => state.setScene);

  const [entityIds, setEntityIds] = useState<Record<string, string>>({});
  const [wallTraces, setWallTraces] = useState<any[]>([]);
  const [stoolState, setStoolState] = useState({ style: "text-zinc-600/50", text: "一张落了灰的破木凳。" });
  const [plantState, setPlantState] = useState({ style: "text-zinc-600 opacity-50 line-through", text: "一盆已经枯死的植物残骸。", canInteract: true });
  const [basketState, setBasketState] = useState({ isVisible: false, style: "", text: "" });

  useEffect(() => {
    setMounted(true);
    fetchWorldEntities();
  }, []);

  const fetchWorldEntities = async () => {
    const { data, error } = await supabase
      .from('world_entities')
      .select(`id, name, entity_components ( component_type, data )`)
      .in('name', ['斑驳的墙', '破木凳', '角落的植物', '生锈的铁筐']);

    if (error) console.error("Fetch Error:", error);

    if (data) {
      const idsMap: Record<string, string> = {};
      
      data.forEach(entity => {
        idsMap[entity.name] = entity.id;
        
        const comps = Array.isArray(entity.entity_components) 
          ? entity.entity_components 
          : [entity.entity_components];

        // 1. 墙壁：套用安全区坐标，不再随机乱跑
        if (entity.name === '斑驳的墙') {
          const graffiti = comps.find((c: any) => c?.component_type === 'trace_graffiti');
          const traces = graffiti?.data?.traces || [];
          const formattedTraces = traces.map((t: any, index: number) => {
            const decay = getTraceStyleAndText(t.text, t.created_at, 'wall');
            const pos = GRAFFITI_SAFE_ZONES[index % GRAFFITI_SAFE_ZONES.length];
            return {
              id: index, text: decay.text, style: decay.style,
              top: pos.top, left: pos.left
            };
          });
          setWallTraces(formattedTraces);
        }

        if (entity.name === '破木凳') {
          const surface = comps.find((c: any) => c?.component_type === 'surface_state');
          const lastOccupied = surface?.data?.last_occupied_at || 0;
          setStoolState(getTraceStyleAndText("", lastOccupied, 'stool'));
        }

        if (entity.name === '角落的植物') {
          const flora = comps.find((c: any) => c?.component_type === 'flora_state');
          const lastWatered = flora?.data?.last_watered_at || 0;
          setPlantState(getTraceStyleAndText("", lastWatered, 'plant'));
        }

        if (entity.name === '生锈的铁筐') {
          const inventory = comps.find((c: any) => c?.component_type === 'inventory');
          const itemText = inventory?.data?.item_text || "一颗薄荷糖";
          const placedAt = inventory?.data?.placed_at || 0;
          const decay = getTraceStyleAndText(itemText, placedAt, 'basket');
          setBasketState({ isVisible: decay.isVisible || false, style: decay.style, text: decay.text });
        }
      });
      
      setEntityIds(idsMap);
    }
  };

  const handleInteract = async (entityName: string, componentType: string, payload: any) => {
    const entityId = entityIds[entityName];
    if (!entityId) return; 

    const nowTimestamp = Date.now();
    
    if (entityName === '破木凳') setStoolState(getTraceStyleAndText("", nowTimestamp, 'stool'));
    if (entityName === '角落的植物') setPlantState(getTraceStyleAndText("", nowTimestamp, 'plant'));

    await supabase.from('entity_components')
      .update({ data: payload, updated_at: new Date().toISOString() })
      .eq('entity_id', entityId)
      .eq('component_type', componentType);
  };

  if (!mounted) return null;

  return (
    <div className="relative w-full h-full bg-[#030303] flex flex-col items-center justify-center select-none overflow-hidden font-mono">
      
      {/* 顶部优雅的返回按钮 */}
      <button
        onClick={() => setScene('entrance')}
        className="absolute top-10 left-8 tracking-[0.2em] text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors duration-500 outline-none z-20"
      >
         [ {lang.HOME.back} ] 
      </button>

      {/* 背景散点墙壁涂鸦 - 强制钉死在周边 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {wallTraces.map((trace) => (
           <span 
             key={trace.id} 
             className={`absolute tracking-[0.2em] transition-opacity duration-1000 ${trace.style}`} 
             style={{ top: trace.top, left: trace.left }}
           >
             {trace.text}
           </span>
        ))}
      </div>

      {/* 核心中轴线 - 重新排列间距，居中对齐 */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md px-6 gap-10">
        
        {/* 铁筐 */}
        <div className="flex items-center justify-center min-h-[24px]">
          {basketState.isVisible ? (
            <p className={`text-[13px] tracking-[0.2em] font-light ${basketState.style}`}>
              [ 铁筐：{basketState.text} ]
            </p>
          ) : (
            <p className="text-[13px] tracking-[0.2em] font-light text-zinc-600/50">
              [ 铁筐里空无一物 ]
            </p>
          )}
        </div>

        {/* 木凳 */}
        <div className="flex items-center justify-center min-h-[24px]">
          <button 
            onClick={() => handleInteract('破木凳', 'surface_state', { last_occupied_at: Date.now() })}
            className={`${stoolState.style} text-[13px] tracking-[0.2em] font-light outline-none cursor-pointer hover:text-zinc-200 transition-colors`}
          >
            [ {stoolState.text} ]
          </button>
        </div>

        {/* 植物 */}
        <div className="flex items-center justify-center min-h-[24px] group relative">
          <span className={`${plantState.style} text-[13px] tracking-[0.2em] font-light transition-colors`}>
            [ {plantState.text} ]
          </span>
          {plantState.canInteract && (
            <button 
              onClick={() => handleInteract('角落的植物', 'flora_state', { last_watered_at: Date.now() })}
              className="absolute -right-16 text-[10px] text-zinc-500 hover:text-zinc-200 tracking-widest outline-none opacity-0 group-hover:opacity-100 transition-opacity"
            >
              (浇水)
            </button>
          )}
        </div>

      </div>
    </div>
  );
}