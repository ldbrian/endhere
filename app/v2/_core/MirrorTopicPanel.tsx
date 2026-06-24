'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from './analytics';
import { useFragmentStore } from './storage';
import type { Fragment } from './fragments';

type TimeFrame = 7 | 30 | 90 | 'all';
type MirrorFragment = { id: string; createdAt: string; title: string; text: string };
type AnalysisTopic = { id: string; label: string; currentCount: number; previousCount: number; deltaPercent: number; dominantSentiment: string; latestFragment: MirrorFragment | null; fragments: MirrorFragment[] };
type Finding = { label: string; count: number; fragments: MirrorFragment[] };
type WordFinding = { label: string; count: number };
type MirrorAnalysis = { source: 'ai' | 'fallback' | 'local'; topTopics: { label: string; count: number }[]; positiveTopic: { label: string; count: number } | null; leastTopic: { label: string; count: number } | null; topics: AnalysisTopic[]; findings: Finding[]; words: WordFinding[] };
type ApiAnalysis = { source?: 'ai' | 'fallback'; summary?: { top_topics?: { label?: string; count?: number }[]; sustained_positive_topic?: { label?: string; count?: number } | null; least_seen_topic?: { label?: string; count?: number } | null }; topics?: { id?: string; label?: string; current_count?: number; previous_count?: number; dominant_sentiment?: string; evidence_ids?: string[]; latest_fragment_id?: string | null }[]; findings?: { label?: string; count?: number; evidence_ids?: string[] }[]; words?: { label?: string; count?: number }[] };

const MIN_ANALYSIS_FRAGMENTS = 10;
const MAX_TOPIC_LABEL_CHARS = 8;
const MAX_SUMMARY_LABEL_CHARS = 6;
const MAX_FINDING_LABEL_CHARS = 12;
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

function sortByCreatedDesc(fragments: MirrorFragment[]) {
  return [...fragments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function filterByFrame(fragments: MirrorFragment[], frame: TimeFrame, offsetWindows = 0) {
  if (frame === 'all') return offsetWindows === 0 ? fragments : [];
  const windowMs = frame * 24 * 60 * 60 * 1000;
  const end = Date.now() - offsetWindows * windowMs;
  const start = end - windowMs;
  return fragments.filter((fragment) => {
    const time = new Date(fragment.createdAt).getTime();
    return Number.isFinite(time) && time <= end && time > start;
  });
}

function percentDelta(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TIME UNKNOWN';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function formatTrend(value: number) {
  if (value === 0) return '0%';
  return (value > 0 ? '↑ ' : '↓ ') + Math.abs(value) + '%';
}

function compactText(text: string, length = 48) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > length ? clean.slice(0, length) + '...' : clean;
}

function compactLabel(value: string, length = MAX_TOPIC_LABEL_CHARS) {
  const clean = value.replace(/[\s\n\r]+/g, '').replace(/[，。！？、,.!?]/g, '').trim();
  return clean.length > length ? clean.slice(0, length) + '...' : clean;
}

function formatSummaryTopics(topics: { label: string; count: number }[]) {
  const labels = topics.slice(0, 2).map((topic) => compactLabel(topic.label, MAX_SUMMARY_LABEL_CHARS));
  return labels.length > 0 ? labels.join(' / ') : '暂无';
}

function normalizeApiAnalysis(data: ApiAnalysis, currentFragments: MirrorFragment[]): MirrorAnalysis {
  const fragmentMap = new Map(currentFragments.map((fragment) => [fragment.id, fragment]));
  const topics = (data.topics || []).map((topic, index) => {
    const evidenceIds = Array.isArray(topic.evidence_ids) ? topic.evidence_ids : [];
    const evidence = evidenceIds.map((id) => fragmentMap.get(id)).filter((item): item is MirrorFragment => Boolean(item));
    const latest = topic.latest_fragment_id ? fragmentMap.get(topic.latest_fragment_id) || evidence[0] || null : evidence[0] || null;
    const currentCount = Number(topic.current_count) || evidence.length;
    const previousCount = Number(topic.previous_count) || 0;
    return { id: topic.id || 'topic-' + index, label: compactLabel(String(topic.label || '').trim(), MAX_TOPIC_LABEL_CHARS), currentCount, previousCount, deltaPercent: percentDelta(currentCount, previousCount), dominantSentiment: compactLabel(String(topic.dominant_sentiment || '未标注').trim(), 5), latestFragment: latest, fragments: evidence };
  }).filter((topic) => topic.label && topic.currentCount > 0).sort((a, b) => b.currentCount - a.currentCount).slice(0, 6);

  const findings = (data.findings || []).map((finding) => {
    const evidenceIds = Array.isArray(finding.evidence_ids) ? finding.evidence_ids : [];
    const evidence = evidenceIds.map((id) => fragmentMap.get(id)).filter((item): item is MirrorFragment => Boolean(item));
    return { label: compactLabel(String(finding.label || '').trim(), MAX_FINDING_LABEL_CHARS), count: Number(finding.count) || evidence.length, fragments: evidence };
  }).filter((finding) => finding.label && finding.count > 0).slice(0, 4);

  const words = (data.words || []).map((word) => ({ label: compactLabel(String(word.label || '').trim(), MAX_WORD_LABEL_CHARS), count: Number(word.count) || 1 })).filter((word) => word.label).slice(0, 6);
  const summary = data.summary || {};
  const topTopics = (summary.top_topics || []).map((topic) => ({ label: compactLabel(String(topic.label || '').trim(), MAX_SUMMARY_LABEL_CHARS), count: Number(topic.count) || 0 })).filter((topic) => topic.label && topic.count > 0).slice(0, 3);
  const positive = summary.sustained_positive_topic;
  const least = summary.least_seen_topic;

  return {
    source: data.source || 'ai',
    topTopics: topTopics.length > 0 ? topTopics.slice(0, 2) : topics.slice(0, 2).map((topic) => ({ label: topic.label, count: topic.currentCount })),
    positiveTopic: positive?.label ? { label: compactLabel(String(positive.label), MAX_TOPIC_LABEL_CHARS), count: Number(positive.count) || 0 } : null,
    leastTopic: least?.label ? { label: compactLabel(String(least.label), MAX_TOPIC_LABEL_CHARS), count: Number(least.count) || 0 } : topics.length > 0 ? { label: topics[topics.length - 1].label, count: topics[topics.length - 1].currentCount } : null,
    topics, findings, words,
  };
}

function localFallbackAnalysis(currentFragments: MirrorFragment[], previousFragments: MirrorFragment[]): MirrorAnalysis {
  const rows = currentFragments.slice(0, 8).map((fragment, index) => {
    const label = compactLabel(compactText(fragment.title || fragment.text, 10) || '碎片 ' + (index + 1), MAX_TOPIC_LABEL_CHARS);
    const previousCount = previousFragments.filter((item) => item.title === fragment.title).length;
    return { id: 'local-' + fragment.id, label, currentCount: 1, previousCount, deltaPercent: percentDelta(1, previousCount), dominantSentiment: '未标注', latestFragment: fragment, fragments: [fragment] };
  });
  return { source: 'local', topTopics: rows.slice(0, 2).map((row) => ({ label: compactLabel(row.label, MAX_SUMMARY_LABEL_CHARS), count: row.currentCount })), positiveTopic: null, leastTopic: rows.length > 0 ? { label: rows[rows.length - 1].label, count: rows[rows.length - 1].currentCount } : null, topics: rows, findings: rows.slice(0, 3).map((row) => ({ label: row.label, count: row.currentCount, fragments: row.fragments })), words: rows.slice(0, 6).map((row) => ({ label: row.label, count: row.currentCount })) };
}

export function MirrorTopicPanel({ embedded = false }: { embedded?: boolean }) {
  const [frame, setFrame] = useState<TimeFrame>(30);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MirrorAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const localFragments = useFragmentStore((state) => state.localFragments);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);
  const mirrorFragments = useMemo(() => sortByCreatedDesc(localFragments.map(toMirrorFragment)), [localFragments]);
  const currentFragments = useMemo(() => filterByFrame(mirrorFragments, frame, 0), [mirrorFragments, frame]);
  const previousFragments = useMemo(() => filterByFrame(mirrorFragments, frame, 1), [mirrorFragments, frame]);
  const fallbackAnalysis = useMemo(() => localFallbackAnalysis(currentFragments, previousFragments), [currentFragments, previousFragments]);
  const displayAnalysis = analysis || fallbackAnalysis;
  const activeSummary = displayAnalysis.topics.find((summary) => summary.id === activeTopic) || null;
  const frameLabel = TIME_FRAMES.find((item) => item.value === frame)?.label || '30 天';
  const hasEnoughFragmentsForAnalysis = mirrorFragments.length >= MIN_ANALYSIS_FRAGMENTS;
  const missingFragmentCount = Math.max(0, MIN_ANALYSIS_FRAGMENTS - mirrorFragments.length);

  useEffect(() => {
    if (!hasHydrated || !hasEnoughFragmentsForAnalysis || currentFragments.length === 0) { setAnalysis(null); setIsAnalyzing(false); return; }
    const controller = new AbortController();
    setIsAnalyzing(true);
    setAnalysis(null);
    fetch('/v2/api/mirror/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ frame, current_fragments: currentFragments, previous_fragments: previousFragments }),
    }).then(async (response) => {
      if (!response.ok) throw new Error('mirror analyze failed');
      const data = await response.json() as ApiAnalysis;
      setAnalysis(normalizeApiAnalysis(data, currentFragments));
    }).catch((error) => {
      if ((error as Error).name !== 'AbortError') { console.warn('[MirrorTopicPanel] analysis fallback:', error); setAnalysis(fallbackAnalysis); }
    }).finally(() => { if (!controller.signal.aborted) setIsAnalyzing(false); });
    return () => controller.abort();
  }, [currentFragments, previousFragments, fallbackAnalysis, frame, hasHydrated, hasEnoughFragmentsForAnalysis]);

  if (!hasHydrated) return <div className={embedded ? 'flex h-full items-center justify-center' : 'min-h-dvh bg-[#101010] px-7 py-12 text-zinc-100'}><p className="text-[11px] tracking-[0.18em] text-zinc-600">正在读取本地碎片</p></div>;
  if (mirrorFragments.length === 0) return <div className={embedded ? 'flex h-full flex-col justify-center' : 'min-h-dvh bg-[#101010] px-7 py-12 text-zinc-100'}><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR SUMMARY</p><p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-zinc-300">这里还没有你的本地碎片。</p><p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-zinc-500">留下第一块碎片后，镜子会从这个浏览器的 localStorage 里读取它。</p></div>;
  if (!hasEnoughFragmentsForAnalysis) return <MirrorInsufficientState embedded={embedded} count={mirrorFragments.length} missing={missingFragmentCount} />;

  return (
    <div className={embedded ? 'h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}>
      <div className="flex items-center justify-between gap-5 border-b border-zinc-900/80 pb-3">
        <div className="flex items-center gap-5">
          {TIME_FRAMES.map((option) => (
            <button key={option.label} type="button" onClick={() => { setFrame(option.value); setActiveTopic(null); track('v3_mirror_timeframe_tap', { frame: option.value }); }} className={(frame === option.value ? 'border-zinc-200 text-zinc-100' : 'border-transparent text-zinc-600 hover:text-zinc-300') + ' border-b pb-1 text-[11px] tracking-[0.12em] transition-colors duration-500'}>{option.label}</button>
          ))}
        </div>
        <Link href="/v2/nostalgia" onClick={() => track('v3_mirror_history_tap')} className="shrink-0 border-b border-dashed border-zinc-700 pb-1 text-[10px] tracking-[0.12em] text-zinc-600 transition-colors duration-500 hover:border-zinc-400 hover:text-zinc-300">历史碎片</Link>
      </div>

      <section className="mt-6 border-b border-zinc-900/80 pb-6">
        <div className="flex items-center justify-between gap-4"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR SUMMARY</p>{isAnalyzing && <span className="text-[9px] tracking-[0.18em] text-zinc-700">ANALYZING</span>}</div>
        <p className="mt-4 text-[13px] tracking-[0.12em] text-zinc-400">{frame === 'all' ? '全部时间' : '过去' + frameLabel}</p>
        <div className="mt-5 grid gap-4 text-[13px] font-light leading-7 tracking-[0.06em] text-zinc-300">
          <ObservationLine label="共留下" value={currentFragments.length + ' 条碎片'} />
          <ObservationLine label="最常出现的话题" value={formatSummaryTopics(displayAnalysis.topTopics)} />
          <ObservationLine label="持续带来积极情绪的话题" value={displayAnalysis.positiveTopic ? compactLabel(displayAnalysis.positiveTopic.label, MAX_SUMMARY_LABEL_CHARS) + '（' + displayAnalysis.positiveTopic.count + ' 次）' : '暂无'} />
          <ObservationLine label="最少被关注的话题" value={displayAnalysis.leastTopic ? compactLabel(displayAnalysis.leastTopic.label, MAX_SUMMARY_LABEL_CHARS) + '（' + displayAnalysis.leastTopic.count + ' 次）' : '暂无'} />
        </div>
      </section>

      <section className="mt-6 border-b border-zinc-900/80 pb-6"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">TREND CHANGES</p><p className="mt-3 text-[12px] tracking-[0.1em] text-zinc-600">与上一周期相比</p><div className="mt-5 grid gap-3">{displayAnalysis.topics.length > 0 ? displayAnalysis.topics.slice(0, 5).map((summary) => <div key={summary.id} className="flex items-center justify-between gap-5 text-[15px] tracking-[0.08em]"><span className="text-zinc-200">{summary.label}</span><span className="font-mono text-[13px] text-slate-400/80">{formatTrend(summary.deltaPercent)}</span></div>) : <p className="text-[12px] tracking-[0.1em] text-zinc-600">这个时间段里还没有可比较的话题。</p>}</div></section>

      <section className="mt-6 grid gap-4"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">TOPIC METRICS</p>{displayAnalysis.topics.map((summary, index) => { const active = activeTopic === summary.id; return <motion.button key={summary.id} type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: index * 0.035 }} onClick={() => { setActiveTopic(active ? null : summary.id); track('v3_mirror_topic_tap', { topic: summary.label, frame }); }} className={(active ? 'outline outline-1 outline-zinc-600/70' : 'hover:bg-zinc-950/50') + ' bg-zinc-950/34 px-5 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.022)] transition-colors'}><div className="flex items-start justify-between gap-5"><div className="min-w-0"><h2 className="text-[23px] font-semibold leading-8 tracking-[0.08em] text-zinc-50">{summary.label}</h2><p className="mt-3 text-[11px] tracking-[0.12em] text-zinc-600">{summary.currentCount} 条碎片<span className="ml-3 font-mono text-slate-400/70">{formatTrend(summary.deltaPercent)}</span></p></div><div className="shrink-0 border border-slate-500/25 px-3 py-2 text-right"><p className="font-mono text-[8px] tracking-[0.18em] text-zinc-600">DOMINANT</p><p className="mt-1 text-[12px] tracking-[0.12em] text-slate-300/90">{summary.dominantSentiment}</p></div></div>{summary.latestFragment && <div className="mt-5 border-l border-zinc-800 pl-4"><p className="font-mono text-[9px] tracking-[0.18em] text-zinc-700">最近一次 / {formatDate(summary.latestFragment.createdAt)}</p><p className="mt-2 line-clamp-2 text-[12px] font-light leading-6 tracking-[0.05em] text-zinc-400">{summary.latestFragment.text}</p></div>}</motion.button>; })}</section>

      <section className="mt-7 border-t border-zinc-900/80 pb-5 pt-6"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR FINDINGS</p><div className="mt-5 grid gap-3 text-[13px] font-light leading-7 tracking-[0.06em] text-zinc-300">{displayAnalysis.findings.length > 0 ? displayAnalysis.findings.map((finding) => <ObservationLine key={finding.label} label={finding.label} value={finding.count + ' 次'} />) : <p className="text-[12px] tracking-[0.1em] text-zinc-600">暂无可陈列事实。</p>}</div><p className="mt-6 font-mono text-[10px] tracking-[0.2em] text-zinc-600">MOST SEEN WORDS</p><div className="mt-5 flex flex-wrap gap-x-5 gap-y-4">{displayAnalysis.words.length > 0 ? displayAnalysis.words.map((word, index) => <span key={word.label} className={(index === 0 ? 'text-zinc-200' : index === 1 ? 'text-zinc-300' : 'text-zinc-500') + ' text-[15px] font-light tracking-[0.08em]'}>{word.label}</span>) : <span className="text-[13px] tracking-[0.08em] text-zinc-600">暂无高频词</span>}</div></section>

      <AnimatePresence>{activeSummary && <motion.section key={activeSummary.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="overflow-hidden border-t border-zinc-800/80 pb-8 pt-5"><div className="mb-5 flex items-center justify-between gap-4"><p className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">EVIDENCE / {activeSummary.label} / {activeSummary.fragments.length}</p><button type="button" onClick={() => setActiveTopic(null)} className="text-[11px] tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200">收起</button></div><div className="grid gap-4">{activeSummary.fragments.map((fragment) => <article key={fragment.id} className="border-l border-zinc-700 pl-4"><p className="font-mono text-[9px] tracking-[0.18em] text-zinc-600">{formatDate(fragment.createdAt)}</p><p className="mt-3 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.05em] text-zinc-300">{fragment.text}</p></article>)}</div></motion.section>}</AnimatePresence>
    </div>
  );
}

function MirrorInsufficientState({ embedded, count, missing }: { embedded: boolean; count: number; missing: number }) {
  return <div className={embedded ? 'flex h-full flex-col justify-center' : 'min-h-dvh bg-[#101010] px-7 py-12 text-zinc-100'}><div className="border-b border-zinc-900/80 pb-5"><div className="flex items-center justify-between gap-4"><p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR SUMMARY</p><Link href="/v2/nostalgia" onClick={() => track('v3_mirror_history_tap')} className="border-b border-dashed border-zinc-700 pb-1 text-[10px] tracking-[0.12em] text-zinc-600 transition-colors duration-500 hover:border-zinc-400 hover:text-zinc-300">历史碎片</Link></div><p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-zinc-300">碎片数不足，暂时无法进行镜子分析。</p><p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-zinc-500">当前共有 {count} 块碎片。至少需要 {MIN_ANALYSIS_FRAGMENTS} 块，还差 {missing} 块。</p></div></div>;
}
function ObservationLine({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 items-baseline justify-between gap-4 border-b border-zinc-900/60 pb-3 last:border-b-0"><span className="shrink-0 whitespace-nowrap text-zinc-500">{label}</span><span className="min-w-0 max-w-[62%] truncate text-right text-zinc-100" title={value}>{value}</span></div>;
}
