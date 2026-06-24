'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from './analytics';
import { useFragmentStore } from './storage';
import type { Fragment } from './fragments';

type TimeFrame = 7 | 30 | 90 | 'all';
type MirrorFragment = { id: string; createdAt: string; title: string; text: string };
type AnalysisRow = { id: string; label: string; currentCount: number; previousCount: number; deltaPercent: number; dominantSentiment: string; latestFragment: MirrorFragment | null; fragments: MirrorFragment[] };
type WordFinding = { label: string; count: number };
type MirrorAnalysis = { source: 'ai' | 'fallback' | 'local'; topPatterns: { label: string; count: number }[]; topLifeAreas: { label: string; count: number }[]; patterns: AnalysisRow[]; lifeAreas: AnalysisRow[]; words: WordFinding[] };
type ApiAnalysis = { source?: 'ai' | 'fallback'; summary?: { top_patterns?: { label?: string; count?: number }[]; top_life_areas?: { label?: string; count?: number }[] }; patterns?: ApiRow[]; life_areas?: ApiRow[]; words?: { label?: string; count?: number }[] };
type ApiRow = { id?: string; label?: string; current_count?: number; previous_count?: number; dominant_sentiment?: string; evidence_ids?: string[]; latest_fragment_id?: string | null };

const MIN_ANALYSIS_FRAGMENTS = 10;
const MIN_CLUSTER_COUNT = 2;
const MAX_LABEL_CHARS = 8;
const MAX_SUMMARY_LABEL_CHARS = 6;
const MAX_WORD_LABEL_CHARS = 6;

const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
  { value: 90, label: '90 天' },
  { value: 'all', label: '全部' },
];

function toMirrorFragment(fragment: Fragment): MirrorFragment {
  return { id: fragment.id, createdAt: fragment.created_at || fragment.updated_at || new Date(0).toISOString(), title: fragment.title || '', text: fragment.original_content || '' };
}

function sortByCreatedDesc(fragments: MirrorFragment[]) { return [...fragments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); }

function filterByFrame(fragments: MirrorFragment[], frame: TimeFrame, offsetWindows = 0) {
  if (frame === 'all') return offsetWindows === 0 ? fragments : [];
  const windowMs = frame * 24 * 60 * 60 * 1000;
  const end = Date.now() - offsetWindows * windowMs;
  const start = end - windowMs;
  return fragments.filter((fragment) => { const time = new Date(fragment.createdAt).getTime(); return Number.isFinite(time) && time <= end && time > start; });
}

function percentDelta(current: number, previous: number) { if (previous === 0 && current === 0) return 0; if (previous === 0) return 100; return Math.round(((current - previous) / previous) * 100); }
function formatDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return 'TIME UNKNOWN'; return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }); }
function formatTrend(value: number) { if (value === 0) return '0%'; return (value > 0 ? '↑ ' : '↓ ') + Math.abs(value) + '%'; }
function compactText(text: string, length = 48) { const clean = text.replace(/\s+/g, ' ').trim(); return clean.length > length ? clean.slice(0, length) + '...' : clean; }
function compactLabel(value: string, length = MAX_LABEL_CHARS) { const clean = value.replace(/[\s\n\r]+/g, '').replace(/[，。！？、,.!?]/g, '').trim(); return clean.length > length ? clean.slice(0, length) + '...' : clean; }
function formatSummaryItems(items: { label: string; count: number }[]) { const labels = items.slice(0, 2).map((item) => compactLabel(item.label, MAX_SUMMARY_LABEL_CHARS)); return labels.length > 0 ? labels.join(' / ') : '暂无'; }

function normalizeRows(rows: ApiRow[] | undefined, currentFragments: MirrorFragment[], kind: 'pattern' | 'area'): AnalysisRow[] {
  const fragmentMap = new Map(currentFragments.map((fragment) => [fragment.id, fragment]));
  return (rows || []).map((row, index) => {
    const evidenceIds = Array.isArray(row.evidence_ids) ? row.evidence_ids : [];
    const evidence = evidenceIds.map((id) => fragmentMap.get(id)).filter((item): item is MirrorFragment => Boolean(item));
    const currentCount = Math.max(Number(row.current_count) || 0, evidence.length);
    const previousCount = Number(row.previous_count) || 0;
    const latest = row.latest_fragment_id ? fragmentMap.get(row.latest_fragment_id) || evidence[0] || null : evidence[0] || null;
    return { id: row.id || kind + '-' + index, label: compactLabel(String(row.label || '').trim()), currentCount, previousCount, deltaPercent: percentDelta(currentCount, previousCount), dominantSentiment: compactLabel(String(row.dominant_sentiment || row.label || '未标注').trim(), 5), latestFragment: latest, fragments: evidence };
  }).filter((row) => row.label && row.currentCount >= MIN_CLUSTER_COUNT && row.fragments.length >= MIN_CLUSTER_COUNT).sort((a, b) => b.currentCount - a.currentCount).slice(0, 6);
}

function normalizeSummary(items: { label?: string; count?: number }[] | undefined) {
  return (items || []).map((item) => ({ label: compactLabel(String(item.label || '').trim(), MAX_SUMMARY_LABEL_CHARS), count: Number(item.count) || 0 })).filter((item) => item.label && item.count >= MIN_CLUSTER_COUNT).slice(0, 2);
}

function normalizeApiAnalysis(data: ApiAnalysis, currentFragments: MirrorFragment[]): MirrorAnalysis {
  const patterns = normalizeRows(data.patterns, currentFragments, 'pattern');
  const lifeAreas = normalizeRows(data.life_areas, currentFragments, 'area');
  const words = (data.words || []).map((word) => ({ label: compactLabel(String(word.label || '').trim(), MAX_WORD_LABEL_CHARS), count: Number(word.count) || 1 })).filter((word) => word.label && word.count >= MIN_CLUSTER_COUNT).slice(0, 6);
  return {
    source: data.source || 'ai',
    topPatterns: normalizeSummary(data.summary?.top_patterns).length > 0 ? normalizeSummary(data.summary?.top_patterns) : patterns.slice(0, 2).map((row) => ({ label: row.label, count: row.currentCount })),
    topLifeAreas: normalizeSummary(data.summary?.top_life_areas).length > 0 ? normalizeSummary(data.summary?.top_life_areas) : lifeAreas.slice(0, 2).map((row) => ({ label: row.label, count: row.currentCount })),
    patterns, lifeAreas, words,
  };
}

const LOCAL_PATTERN_RULES = [
  { id: 'anger', label: '愤怒', words: ['傻逼', '垃圾', '脑残', '生气', '愤怒', '火大', '讨厌', '阻碍'] },
  { id: 'complaint', label: '抱怨', words: ['差到爆', '烦', '糟', '破', '又', '怎么', '真是'] },
  { id: 'fatigue', label: '疲惫', words: ['累', '疲惫', '困', '撑不住', '没力气', '耗尽', '白洗'] },
  { id: 'money-anxiety', label: '金钱焦虑', words: ['钱', '收入', '生意', '房贷', '房租', '账单', '花钱', '成本'] },
  { id: 'helplessness', label: '无奈', words: ['没办法', '只能', '又', '还是', '算了', '不停'] },
] as const;
const LOCAL_AREA_RULES = [
  { id: 'traffic', label: '交通', words: ['交通', '通勤', '网约车', '派单', '堵车', '司机', '共享单车', '路口'] },
  { id: 'work', label: '工作', words: ['工作', '上班', '公司', '客户', '老板', '项目', '会议'] },
  { id: 'money', label: '金钱', words: ['钱', '收入', '生意', '房贷', '房租', '账单', '花钱'] },
  { id: 'family', label: '家庭', words: ['家', '父母', '孩子', '老婆', '老公', '亲戚'] },
  { id: 'body', label: '身体', words: ['身体', '腰痛', '头痛', '生病', '医院', '药', '累'] },
] as const;
function includesAny(fragment: MirrorFragment, words: readonly string[]) { const text = (fragment.title + '\n' + fragment.text).toLowerCase(); return words.some((word) => text.includes(word.toLowerCase())); }
function buildLocalRows(rules: readonly { id: string; label: string; words: readonly string[] }[], current: MirrorFragment[], previous: MirrorFragment[]): AnalysisRow[] { return rules.map((rule) => { const hits = current.filter((fragment) => includesAny(fragment, rule.words)); const previousCount = previous.filter((fragment) => includesAny(fragment, rule.words)).length; return { id: rule.id, label: rule.label, currentCount: hits.length, previousCount, deltaPercent: percentDelta(hits.length, previousCount), dominantSentiment: rule.label, latestFragment: hits[0] || null, fragments: hits }; }).filter((row) => row.currentCount >= MIN_CLUSTER_COUNT).sort((a, b) => b.currentCount - a.currentCount).slice(0, 6); }
function localFallbackAnalysis(currentFragments: MirrorFragment[], previousFragments: MirrorFragment[]): MirrorAnalysis { const patterns = buildLocalRows(LOCAL_PATTERN_RULES, currentFragments, previousFragments); const lifeAreas = buildLocalRows(LOCAL_AREA_RULES, currentFragments, previousFragments); return { source: 'local', topPatterns: patterns.slice(0, 2).map((row) => ({ label: row.label, count: row.currentCount })), topLifeAreas: lifeAreas.slice(0, 2).map((row) => ({ label: row.label, count: row.currentCount })), patterns, lifeAreas, words: [...patterns, ...lifeAreas].slice(0, 6).map((row) => ({ label: row.label, count: row.currentCount })) }; }

export function MirrorTopicPanel({ embedded = false }: { embedded?: boolean }) {
  const [frame, setFrame] = useState<TimeFrame>(30);
  const [activeRow, setActiveRow] = useState<AnalysisRow | null>(null);
  const [analysis, setAnalysis] = useState<MirrorAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const localFragments = useFragmentStore((state) => state.localFragments);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);
  const mirrorFragments = useMemo(() => sortByCreatedDesc(localFragments.map(toMirrorFragment)), [localFragments]);
  const currentFragments = useMemo(() => filterByFrame(mirrorFragments, frame, 0), [mirrorFragments, frame]);
  const previousFragments = useMemo(() => filterByFrame(mirrorFragments, frame, 1), [mirrorFragments, frame]);
  const fallbackAnalysis = useMemo(() => localFallbackAnalysis(currentFragments, previousFragments), [currentFragments, previousFragments]);
  const displayAnalysis = analysis || fallbackAnalysis;
  const frameLabel = TIME_FRAMES.find((item) => item.value === frame)?.label || '30 天';
  const hasEnoughFragmentsForAnalysis = mirrorFragments.length >= MIN_ANALYSIS_FRAGMENTS;
  const missingFragmentCount = Math.max(0, MIN_ANALYSIS_FRAGMENTS - mirrorFragments.length);

  useEffect(() => {
    if (!hasHydrated || !hasEnoughFragmentsForAnalysis || currentFragments.length === 0) { setAnalysis(null); setIsAnalyzing(false); return; }
    const controller = new AbortController();
    setIsAnalyzing(true); setAnalysis(null);
    fetch('/v2/api/mirror/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ frame, current_fragments: currentFragments, previous_fragments: previousFragments }) })
      .then(async (response) => { if (!response.ok) throw new Error('mirror analyze failed'); const data = await response.json() as ApiAnalysis; setAnalysis(normalizeApiAnalysis(data, currentFragments)); })
      .catch((error) => { if ((error as Error).name !== 'AbortError') { console.warn('[MirrorTopicPanel] analysis fallback:', error); setAnalysis(fallbackAnalysis); } })
      .finally(() => { if (!controller.signal.aborted) setIsAnalyzing(false); });
    return () => controller.abort();
  }, [currentFragments, previousFragments, fallbackAnalysis, frame, hasHydrated, hasEnoughFragmentsForAnalysis]);

  if (!hasHydrated) return <div className={embedded ? 'flex h-full items-center justify-center' : 'min-h-dvh bg-[#101010] px-7 py-12 text-zinc-100'}><p className="text-[11px] tracking-[0.18em] text-zinc-600">正在读取本地碎片</p></div>;
  if (mirrorFragments.length === 0) return <div className={embedded ? 'flex h-full flex-col justify-center' : 'min-h-dvh bg-[#101010] px-7 py-12 text-zinc-100'}><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR SUMMARY</p><p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-zinc-300">这里还没有你的本地碎片。</p><p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-zinc-500">留下第一块碎片后，镜子会从这个浏览器的 localStorage 里读取它。</p></div>;
  if (!hasEnoughFragmentsForAnalysis) return <MirrorInsufficientState embedded={embedded} count={mirrorFragments.length} missing={missingFragmentCount} />;

  return (
    <div className={embedded ? 'h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}>
      <div className="flex items-center justify-between gap-5 border-b border-zinc-900/80 pb-3"><div className="flex items-center gap-5">{TIME_FRAMES.map((option) => <button key={option.label} type="button" onClick={() => { setFrame(option.value); setActiveRow(null); track('v3_mirror_timeframe_tap', { frame: option.value }); }} className={(frame === option.value ? 'border-zinc-200 text-zinc-100' : 'border-transparent text-zinc-600 hover:text-zinc-300') + ' border-b pb-1 text-[11px] tracking-[0.12em] transition-colors duration-500'}>{option.label}</button>)}</div><Link href="/v2/nostalgia" onClick={() => track('v3_mirror_history_tap')} className="shrink-0 border-b border-dashed border-zinc-700 pb-1 text-[10px] tracking-[0.12em] text-zinc-600 transition-colors duration-500 hover:border-zinc-400 hover:text-zinc-300">历史碎片</Link></div>
      <section className="mt-6 border-b border-zinc-900/80 pb-6"><div className="flex items-center justify-between gap-4"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR SUMMARY</p>{isAnalyzing && <span className="text-[9px] tracking-[0.18em] text-zinc-700">ANALYZING</span>}</div><p className="mt-4 text-[13px] tracking-[0.12em] text-zinc-400">{frame === 'all' ? '全部时间' : '过去' + frameLabel}</p><div className="mt-5 grid gap-4 text-[13px] font-light leading-7 tracking-[0.06em] text-zinc-300"><ObservationLine label="共留下" value={currentFragments.length + ' 条碎片'} /><ObservationLine label="主要重复模式" value={formatSummaryItems(displayAnalysis.topPatterns)} /><ObservationLine label="主要生活领域" value={formatSummaryItems(displayAnalysis.topLifeAreas)} /></div></section>
      <section className="mt-6 border-b border-zinc-900/80 pb-6"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR PATTERNS</p><div className="mt-5 grid gap-3">{displayAnalysis.patterns.length > 0 ? displayAnalysis.patterns.map((row, index) => <PatternButton key={row.id} row={row} index={index} active={activeRow?.id === row.id} onClick={() => { setActiveRow(activeRow?.id === row.id ? null : row); track('v3_mirror_pattern_tap', { pattern: row.label, frame }); }} />) : <p className="text-[12px] tracking-[0.1em] text-zinc-600">这个时间段里还没有重复模式。</p>}</div></section>
      <section className="mt-6 border-b border-zinc-900/80 pb-6"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">LIFE AREAS</p><div className="mt-5 grid gap-3">{displayAnalysis.lifeAreas.length > 0 ? displayAnalysis.lifeAreas.map((row) => <button key={row.id} type="button" onClick={() => { setActiveRow(activeRow?.id === row.id ? null : row); track('v3_mirror_area_tap', { area: row.label, frame }); }} className="flex items-center justify-between gap-4 border-b border-zinc-900/60 pb-3 text-left"><span className="min-w-0 truncate text-[14px] tracking-[0.08em] text-zinc-300">{row.label}</span><span className="shrink-0 font-mono text-[12px] text-slate-400/75">{row.currentCount} / {formatTrend(row.deltaPercent)}</span></button>) : <p className="text-[12px] tracking-[0.1em] text-zinc-600">暂无重复生活领域。</p>}</div></section>
      <section className="mt-7 border-t border-zinc-900/80 pb-5 pt-6"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MOST SEEN WORDS</p><div className="mt-5 flex flex-wrap gap-x-5 gap-y-4">{displayAnalysis.words.length > 0 ? displayAnalysis.words.map((word, index) => <span key={word.label} className={(index === 0 ? 'text-zinc-200' : index === 1 ? 'text-zinc-300' : 'text-zinc-500') + ' text-[15px] font-light tracking-[0.08em]'}>{word.label}</span>) : <span className="text-[13px] tracking-[0.08em] text-zinc-600">暂无高频词</span>}</div></section>
      <AnimatePresence>{activeRow && <motion.section key={activeRow.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="overflow-hidden border-t border-zinc-800/80 pb-8 pt-5"><div className="mb-5 flex items-center justify-between gap-4"><p className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">EVIDENCE / {activeRow.label} / {activeRow.fragments.length}</p><button type="button" onClick={() => setActiveRow(null)} className="text-[11px] tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200">收起</button></div><div className="grid gap-4">{activeRow.fragments.map((fragment) => <article key={fragment.id} className="border-l border-zinc-700 pl-4"><p className="font-mono text-[9px] tracking-[0.18em] text-zinc-600">{formatDate(fragment.createdAt)}</p><p className="mt-3 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.05em] text-zinc-300">{fragment.text}</p></article>)}</div></motion.section>}</AnimatePresence>
    </div>
  );
}

function PatternButton({ row, index, active, onClick }: { row: AnalysisRow; index: number; active: boolean; onClick: () => void }) { return <motion.button type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: index * 0.035 }} onClick={onClick} className={(active ? 'outline outline-1 outline-zinc-600/70' : 'hover:bg-zinc-950/50') + ' bg-zinc-950/34 px-5 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.022)] transition-colors'}><div className="flex items-start justify-between gap-5"><div className="min-w-0"><h2 className="truncate text-[23px] font-semibold leading-8 tracking-[0.08em] text-zinc-50">{row.label}</h2><p className="mt-3 text-[11px] tracking-[0.12em] text-zinc-600">{row.currentCount} 条碎片<span className="ml-3 font-mono text-slate-400/70">{formatTrend(row.deltaPercent)}</span></p></div><div className="shrink-0 border border-slate-500/25 px-3 py-2 text-right"><p className="font-mono text-[8px] tracking-[0.18em] text-zinc-600">PATTERN</p><p className="mt-1 text-[12px] tracking-[0.12em] text-slate-300/90">{row.dominantSentiment}</p></div></div>{row.latestFragment && <div className="mt-5 border-l border-zinc-800 pl-4"><p className="font-mono text-[9px] tracking-[0.18em] text-zinc-700">最近一次 / {formatDate(row.latestFragment.createdAt)}</p><p className="mt-2 line-clamp-2 text-[12px] font-light leading-6 tracking-[0.05em] text-zinc-400">{row.latestFragment.text}</p></div>}</motion.button>; }
function MirrorInsufficientState({ embedded, count, missing }: { embedded: boolean; count: number; missing: number }) { return <div className={embedded ? 'flex h-full flex-col justify-center' : 'min-h-dvh bg-[#101010] px-7 py-12 text-zinc-100'}><div className="border-b border-zinc-900/80 pb-5"><div className="flex items-center justify-between gap-4"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR SUMMARY</p><Link href="/v2/nostalgia" onClick={() => track('v3_mirror_history_tap')} className="border-b border-dashed border-zinc-700 pb-1 text-[10px] tracking-[0.12em] text-zinc-600 transition-colors duration-500 hover:border-zinc-400 hover:text-zinc-300">历史碎片</Link></div><p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-zinc-300">碎片数不足，暂时无法进行镜子分析。</p><p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-zinc-500">当前共有 {count} 块碎片。至少需要 {MIN_ANALYSIS_FRAGMENTS} 块，还差 {missing} 块。</p></div></div>; }
function ObservationLine({ label, value }: { label: string; value: string }) { return <div className="flex min-w-0 items-baseline justify-between gap-4 border-b border-zinc-900/60 pb-3 last:border-b-0"><span className="shrink-0 whitespace-nowrap text-zinc-500">{label}</span><span className="min-w-0 max-w-[62%] truncate text-right text-zinc-100" title={value}>{value}</span></div>; }