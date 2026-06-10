'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { createClient } from '@supabase/supabase-js';
import { getTraceStyleAndText, TraceDecayResult } from '../../utils/traceDecay';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorldSummary } from '../../hooks/useWorldSummary';
import { track } from '../../lib/track';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHELL_OPTIONS = [
  { id: '一把伞', label: '一把伞' },
  { id: '一件外套', label: '一件外套' },
  { id: '一本书', label: '一本书' },
  { id: '一杯还没喝完的饮料', label: '一杯还没喝完的饮料' },
  { id: '一张纸条', label: '一张纸条' },
  { id: '一副耳机', label: '一副耳机' },
  { id: '一双鞋', label: '一双鞋' },
  { id: '一首歌', label: '一首歌' },
];

export default function RoamingArea() {
  const [mounted, setMounted] = useState(false);
  const lang = useLanguage();
  const envText = useWorldSummary();
  const setScene = useSpaceStore((state) => state.setScene);
  
  const { canInteractBasketToday, markBasketInteraction } = useShelterStore();

  const [sentences, setSentences] = useState<string[]>(['...']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeGraffiti, setActiveGraffiti] = useState<string | null>(null);
  
  const [entityIds, setEntityIds] = useState<Record<string, string>>({});
  const [wallTraces, setWallTraces] = useState<any[]>([]);
  const [currentTraceIndex, setCurrentTraceIndex] = useState(0); // 🟢 新增：墙面轮播状态

  const [stoolState, setStoolState] = useState<TraceDecayResult>({ style: "text-zinc-600/50", text: "一张落了灰的破木凳。", isVisible: true, canInteract: true });
  const [plantState, setPlantState] = useState<TraceDecayResult>({ style: "text-zinc-600 opacity-50", text: "一盆已经枯死的植物残骸", isVisible: true, canInteract: true });
  
  const [basketItems, setBasketItems] = useState<any[]>([]);
  const [isBasketOpen, setIsBasketOpen] = useState(false); // 🟢 新增：铁筐折叠状态机
  const [selectedShell, setSelectedShell] = useState(SHELL_OPTIONS[0].id);
  const [sliceText, setSliceText] = useState('');
  const [putStatus, setPutStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeSlice, setActiveSlice] = useState<any | null>(null);

  useEffect(() => {
    if (!envText || envText === '...') return;
    const parts = envText.split(/[。！？.!?]/).map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length > 0) {
      setSentences(parts);
      setCurrentIndex(0);
    }
  }, [envText]);
  
  useEffect(() => {
    if (sentences.length <= 1) return;
    const timer = setInterval(() => setCurrentIndex((prev) => (prev + 1) % sentences.length), 5000);
    return () => clearInterval(timer);
  }, [sentences.length]);

  // 🟢 墙面痕迹 15秒轮播器
  useEffect(() => {
    if (wallTraces.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentTraceIndex((prev) => (prev + 1) % wallTraces.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [wallTraces.length]);

  useEffect(() => {
    setMounted(true);
    fetchWorldEntities();
    fetchBasketItems();
  }, []);

  const fetchWorldEntities = async () => {
    const { data } = await supabase
      .from('world_entities')
      .select(`id, name, entity_components ( component_type, data )`)
      .in('name', ['斑驳的墙', '破木凳', '角落的植物']);

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
            return { id: index, text: decay.text }; // 剥离旧的随机坐标系
          });
          setWallTraces(formattedTraces);
        }
        if (entity.name === '破木凳') {
          const surface = comps.find((c: any) => c?.component_type === 'surface_state');
          setStoolState(getTraceStyleAndText("", surface?.data?.last_occupied_at || 0, 'stool'));
        }
        if (entity.name === '角落的植物') {
          const flora = comps.find((c: any) => c?.component_type === 'flora_state');
          setPlantState(getTraceStyleAndText("", flora?.data?.last_watered_at || 0, 'plant'));
        }
      });
      setEntityIds(idsMap);
    }
  };

  const fetchBasketItems = async () => {
    const { data } = await supabase.from('iron_basket_items').select('*').limit(3);
    if (data) setBasketItems(data);
  };

  const handleInteract = async (entityName: string, componentType: string, payload: any) => {
    const entityId = entityIds[entityName];
    if (!entityId) return; 
    const nowTimestamp = Date.now();
    if (entityName === '破木凳') setStoolState(getTraceStyleAndText("", nowTimestamp, 'stool'));
    if (entityName === '角落的植物') setPlantState(getTraceStyleAndText("", nowTimestamp, 'plant'));

    await supabase.from('entity_components').update({ data: payload, updated_at: new Date().toISOString() })
      .eq('entity_id', entityId).eq('component_type', componentType);
  };

  const handlePutBasket = async () => {
    if (!sliceText.trim()) return;
    setPutStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/basket/put', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_shell: selectedShell, life_slice: sliceText.trim() })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'System Error');

      track('BASKET_PUT', { shell: selectedShell });
      setPutStatus('done');
      setIsBasketOpen(false); // 成功后自动折叠
      markBasketInteraction('put');
    } catch (err: any) {
      setPutStatus('error');
      setErrorMsg(err.message);
    }
  };

  const handleTakeBasket = async (item: any) => {
    if (!canInteractBasketToday('take')) return;
    setActiveSlice(item);
    setBasketItems(prev => prev.filter(i => i.id !== item.id));
    await supabase.from('iron_basket_items').update({ is_claimed: true }).eq('id', item.id);
    track('BASKET_TAKE');
    markBasketInteraction('take');
  };

  if (!mounted) return null;

  return (
    <div className="relative w-full h-[100dvh] bg-[#030303] select-none overflow-hidden font-mono text-zinc-500">

      {/* ↖ 左上：返回按钮 */}
      <div className="absolute top-10 left-8 z-20">
        <button onClick={() => setScene('entrance')} className="tracking-[0.2em] text-[11px] hover:text-zinc-200 transition-colors duration-500 outline-none">
          {lang.HOME.back} 
        </button>
      </div>

      {/* ↗ 右上：NPC/环境播报 */}
      <div className="absolute top-10 right-8 z-20 max-w-[55%] text-right">
        <AnimatePresence mode="wait">
          <motion.button
            key={currentIndex}
            initial={{ opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(2px)' }} transition={{ duration: 1.5, ease: "easeInOut" }}
            onClick={() => track('v3_env_interact', { target_text: sentences[currentIndex] })}
            className="text-[11px] text-zinc-700/60 tracking-[0.2em] hover:text-zinc-300 transition-colors duration-500 outline-none cursor-pointer text-right"
          >
            [ {sentences[currentIndex]} ]
          </motion.button>
        </AnimatePresence>
      </div>

      {/* 中央交互区 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-12 z-10 w-full max-w-xs px-8">
        
        {/* 铁筐区 */}
        <div className="flex flex-col items-center w-full gap-6">

          {basketItems.length > 0 && canInteractBasketToday('take') && (
            <div className="flex flex-col items-center gap-3 mb-2">
              <span className="text-[10px] text-zinc-700 tracking-[0.25em]">有人在这里留下了东西</span>
              <div className="flex flex-wrap gap-3 justify-center">
                {basketItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleTakeBasket(item)}
                    className="text-[12px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors outline-none"
                  >
                    {item.item_shell}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!canInteractBasketToday('put') || putStatus === 'done' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] tracking-[0.25em] text-zinc-700">今天已经留过东西了</span>
              <span className="text-[10px] tracking-[0.2em] text-zinc-800">明天可以再来</span>
            </div>
          ) : !isBasketOpen ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-[11px] text-zinc-600 tracking-[0.2em] text-center leading-loose">
                把一样东西留在这里<br />
                <span className="text-zinc-800">下一个路过的人会看到它</span>
              </p>
              <button
                onClick={() => setIsBasketOpen(true)}
                className="text-zinc-500 hover:text-zinc-200 text-[12px] tracking-[0.3em] transition-colors duration-500 outline-none"
              >
                [ 放下一样东西 ]
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-5 w-full"
            >
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-700 tracking-[0.2em]">它是什么</span>
                <div className="flex flex-wrap gap-2">
                  {SHELL_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedShell(opt.id)}
                      className={`text-[11px] tracking-widest transition-colors outline-none ${
                        selectedShell === opt.id
                          ? 'text-zinc-300 underline underline-offset-4'
                          : 'text-zinc-700 hover:text-zinc-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-700 tracking-[0.2em]">用你自己的方式描述它</span>
                <textarea
                  maxLength={100}
                  value={sliceText}
                  onChange={(e) => setSliceText(e.target.value)}
                  placeholder={`比如：一把旧伞，有点年头了，但还能撑开...`}
                  className="h-[72px] bg-transparent text-zinc-400 text-[13px] outline-none resize-none placeholder:text-zinc-800 leading-relaxed border-b border-zinc-800 focus:border-zinc-600 transition-colors pb-1"
                />
                <span className="text-[10px] text-zinc-800 text-right">{sliceText.length}/100</span>
              </div>

              {putStatus === 'error' && (
                <p className="text-red-900/80 text-[10px] tracking-widest">{errorMsg}</p>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsBasketOpen(false)}
                  className="text-[11px] text-zinc-800 hover:text-zinc-600 tracking-widest outline-none transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handlePutBasket}
                  disabled={putStatus === 'submitting' || !sliceText.trim()}
                  className="text-[12px] text-zinc-500 hover:text-zinc-200 disabled:opacity-20 tracking-[0.25em] transition-colors outline-none"
                >
                  {putStatus === 'submitting' ? '放下中...' : '[ 放下它 ]'}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* 木凳 */}
        <button 
          onClick={() => handleInteract('破木凳', 'surface_state', { last_occupied_at: Date.now() })}
          className={`text-[13px] tracking-[0.2em] font-light outline-none cursor-pointer hover:text-zinc-200 transition-colors ${stoolState.style || 'text-zinc-600/50'}`}
        >
          [ {stoolState.text} ]
        </button>

      </div>

      {/* ↙ 左下：角落植物 */}
      <div className="absolute bottom-10 left-8 z-20 max-w-[45%]">
        <div className="flex flex-col items-start gap-4">
          {plantState.canInteract ? (
            <>
              <span className="text-[11px] md:text-[12px] tracking-[0.2em] font-light text-zinc-700 leading-relaxed">
                植物的叶子有些发黄，泥土干裂
              </span>
              <button 
                onClick={() => handleInteract('角落的植物', 'flora_state', { last_watered_at: Date.now() })}
                className="text-[10px] hover:text-zinc-300 tracking-widest transition-colors outline-none"
              >
                [ 浇点水 ]
              </button>
            </>
          ) : (
            <span className="text-[11px] md:text-[12px] tracking-[0.2em] font-light leading-relaxed">
              角落里的植物泥土微湿
            </span>
          )}
        </div>
      </div>

      {/* ↘ 右下：墙面痕迹 */}
      <div className="absolute bottom-10 right-8 z-20 max-w-[45%] text-right">
        <AnimatePresence mode="wait">
          {wallTraces.length > 0 && (
            <motion.button
              key={currentTraceIndex}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2 }}
              onClick={() => setActiveGraffiti(wallTraces[currentTraceIndex].text)}
              className="text-[10px] text-zinc-700 tracking-[0.2em] leading-loose text-right hover:text-zinc-400 transition-colors outline-none cursor-pointer"
            >
              {wallTraces[currentTraceIndex].text}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ================= 终端查阅弹窗 ================= */}
      <AnimatePresence>
        {(activeGraffiti || activeSlice) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6"
            onClick={() => { setActiveGraffiti(null); setActiveSlice(null); }}
          >
            <div className="border border-zinc-800 bg-[#050505] p-8 max-w-sm w-full text-center flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              {activeSlice && <span className="text-[10px] tracking-widest mb-4">别人留下的：{activeSlice.item_shell}</span>}
              <p className="text-zinc-300 text-[13px] tracking-[0.2em] font-light leading-loose">
                {activeGraffiti || activeSlice?.life_slice}
              </p>
              <button 
                onClick={() => { setActiveGraffiti(null); setActiveSlice(null); }}
                className="mt-10 text-[10px] hover:text-zinc-400 tracking-widest outline-none"
              >
                [ 关闭 ]
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}