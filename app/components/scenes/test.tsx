'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpaceStore } from '../../store/useSpaceStore';
import { createClient } from '@supabase/supabase-js';
import { getTraceStyleAndText, TraceDecayResult } from '../../utils/traceDecay';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RoamingArea() {
  const [mounted, setMounted] = useState(false);
  const lang = useLanguage();
  const setScene = useSpaceStore((state) => state.setScene);

  const [entityIds, setEntityIds] = useState<Record<string, string>>({});
  const [wallTraces, setWallTraces] = useState<any[]>([]);
  
  // 🟢 新增：当前激活查看的涂鸦文本
  const [activeGraffiti, setActiveGraffiti] = useState<string | null>(null);
  
  const [stoolState, setStoolState] = useState<TraceDecayResult>({ 
    style: "text-zinc-600/50", text: "一张落了灰的破木凳。", isVisible: true, canInteract: true 
  });
  
  const [plantState, setPlantState] = useState<TraceDecayResult>({ 
    style: "text-zinc-600 opacity-50", text: "一盆已经枯死的植物残骸", isVisible: true, canInteract: true 
  });
  
  const [basketState, setBasketState] = useState<TraceDecayResult>({ 
    isVisible: false, style: "", text: "", canInteract: false 
  });

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
        
        const comps = Array.isArray(entity.entity_components) ? entity.entity_components : [entity.entity_components];

        if (entity.name === '斑驳的墙') {
          const graffiti = comps.find((c: any) => c?.component_type === 'trace_graffiti');
          const traces = graffiti?.data?.traces || [];
          const formattedTraces = traces.map((t: any, index: number) => {
            const decay = getTraceStyleAndText(t.text, t.created_at, 'wall');
            const isLeft = Math.random() > 0.5;
            const horizontalPos = isLeft ? `${5 + Math.random() * 15}%` : `${80 + Math.random() * 15}%`;
            const verticalPos = `${10 + Math.random() * 80}%`;
            
            return {
              id: index, text: decay.text, style: decay.style,
              top: verticalPos, left: horizontalPos
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
          setBasketState({ isVisible: decay.isVisible || false, style: decay.style, text: decay.text, canInteract: false });
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
      
      <button
        onClick={() => setScene('entrance')}
        className="absolute top-10 left-8 tracking-[0.2em] text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors duration-500 outline-none z-20"
      >
        [ {lang.HOME.back} ] 
      </button>

      {/* 边缘散点涂鸦区 - 赋予了交互指针和点击事件 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {wallTraces.map((trace) => (
           <button 
             key={trace.id} 
             onClick={() => setActiveGraffiti(trace.text)}
             className={`absolute tracking-[0.2em] transition-all duration-700 pointer-events-auto hover:text-zinc-300 hover:opacity-100 outline-none text-left max-w-[120px] ${trace.style}`} 
             style={{ top: trace.top, left: trace.left }}
           >
             {trace.text}
           </button>
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md px-6 gap-20">
        
        <div className="flex items-center justify-center min-h-[24px]">
          {basketState.isVisible ? (
            <p className={`text-[13px] tracking-[0.2em] font-light ${basketState.style}`}>
              铁筐：{basketState.text}
            </p>
          ) : (
            <p className="text-[13px] tracking-[0.2em] font-light text-zinc-600/50">
              铁筐里空无一物
            </p>
          )}
        </div>

        <div className="flex items-center justify-center min-h-[24px]">
          <button 
            onClick={() => handleInteract('破木凳', 'surface_state', { last_occupied_at: Date.now() })}
            className={`${stoolState.style} text-[13px] tracking-[0.2em] font-light outline-none cursor-pointer hover:text-zinc-200 transition-colors`}
          >
            [ {stoolState.text} ]
          </button>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[40px] gap-4">
          {plantState.canInteract ? (
            <>
              <span className="text-[13px] tracking-[0.2em] font-light text-zinc-700 transition-colors">
                植物的叶子有些发黄，泥土干裂
              </span>
              <button 
                onClick={() => handleInteract('角落的植物', 'flora_state', { last_watered_at: Date.now() })}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 tracking-widest transition-colors outline-none"
              >
                [ 浇点水 ]
              </button>
            </>
          ) : (
            <span className="text-[13px] tracking-[0.2em] font-light text-zinc-500 transition-colors">
              角落里的植物泥土微湿
            </span>
          )}
        </div>

      </div>

      {/* 🟢 涂鸦点击后的终端查阅弹窗 */}
      <AnimatePresence>
        {activeGraffiti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6"
            onClick={() => setActiveGraffiti(null)}
          >
            <div 
              className="border border-zinc-800 bg-[#050505] p-8 max-w-sm w-full text-center flex flex-col items-center"
              onClick={(e) => e.stopPropagation()} // 防止点击框体关闭
            >
              <p className="text-zinc-300 text-[13px] tracking-[0.2em] font-light leading-loose">
                {activeGraffiti}
              </p>
              <button 
                onClick={() => setActiveGraffiti(null)}
                className="mt-10 text-[10px] text-zinc-600 hover:text-zinc-400 tracking-widest outline-none"
              >
                [ CLOSE ]
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}