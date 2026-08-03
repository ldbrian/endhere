'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from '../_core/analytics';
import { useFragmentStore } from '../_core/storage';
import { useWaysArchive } from '../_core/waysArchive';
import { LENSES } from '../../lib/ways/lens';

type PatternRow = {
  id: string;
  label: string;
  current_count: number;
  previous_count: number;
  dominant_sentiment: string;
  evidence_ids: string[];
  latest_fragment_id: string | null;
};

type LifeAreaRow = PatternRow;

type MirrorAnalysis = {
  source: string;
  summary: {
    top_patterns: { label: string; count: number }[];
    top_life_areas: { label: string; count: number }[];
  };
  patterns: PatternRow[];
  life_areas: LifeAreaRow[];
  words: { label: string; count: number }[];
};

const BOOKMARK_STAGES = [
  { min: 0, max: 2, title: '第一次照见' },
  { min: 3, max: 5, title: '第一次照见' },
  { min: 6, max: 14, title: '这一段时间的样子' },
  { min: 15, max: Infinity, title: '这一段时间的样子' },
] as const;

function getBookmarkStage(completedPages: number) {
  return BOOKMARK_STAGES.find((stage) => completedPages >= stage.min && completedPages <= stage.max) || BOOKMARK_STAGES[0];
}

function formatShortDate(value?: string | null) {
  if (!value) return '——';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '——';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function compact(text: string, max = 22) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '这一页';
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function pickSlipQuote(text: string) {
  const sentence = text
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter(Boolean)[0] || text.trim();
  return compact(sentence, 22);
}

function buildEvidenceCards(pages: ReturnType<typeof useFragmentStore.getState>['book']['pages']) {
  return pages
    .filter((page) => page.paragraphs.length > 0)
    .slice(-3)
    .reverse()
    .map((page) => {
      const lastParagraph = page.paragraphs[page.paragraphs.length - 1];
      const text = page.paragraphs.map((paragraph) => paragraph.text).filter(Boolean).join(' ');
      return {
        id: page.id,
        pageNumber: page.page_number,
        label: pickSlipQuote(text || lastParagraph?.text || ''),
        date: formatShortDate(lastParagraph?.timestamp || page.closed_at || page.opened_at),
      };
    });
}

function BookmarkProgressBar({ completedPages }: { completedPages: number }) {
  const target = 15;
  const percent = Math.max(0, Math.min(100, (completedPages / target) * 100));
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="mb-2 flex items-center justify-between text-[10px] tracking-[0.14em] text-stone-500/80">
        <span>已记录</span>
        <span>{completedPages} 页</span>
      </div>
      <div className="h-[8px] overflow-hidden rounded-full bg-stone-800/55">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="h-full rounded-full bg-[linear-gradient(90deg,#7b5d3d_0%,#b28a5f_55%,#d7bb8b_100%)] shadow-[0_0_12px_rgba(178,138,95,0.28)]"
        />
      </div>
    </div>
  );
}

function EvidenceSlips({ items }: { items: { id: string; pageNumber: string; label: string; date: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-10 space-y-3">
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex items-center justify-between border-b border-stone-800/55 pb-3 text-[13px] text-stone-300"
        >
          <div className="min-w-0 pr-4">
            <p className="truncate tracking-[0.06em]">“{item.label}”</p>
            <p className="mt-1 font-mono text-[10px] tracking-[0.16em] text-stone-500/75">第 {item.pageNumber} 页</p>
          </div>
          <p className="shrink-0 font-mono text-[10px] tracking-[0.16em] text-stone-500/80">{item.date}</p>
        </motion.div>
      ))}
    </div>
  );
}

function PatternList({
  patterns,
  lifeAreas,
}: {
  patterns: PatternRow[];
  lifeAreas: LifeAreaRow[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const all = [
    ...patterns.map((p) => ({ ...p, _kind: 'pattern' as const })),
    ...lifeAreas.map((l) => ({ ...l, _kind: 'life_area' as const })),
  ].sort((a, b) => b.current_count - a.current_count);
  const active = all.find((item) => item.id === activeId) || all[0] || null;

  if (all.length === 0) return null;

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div className="space-y-3 border-b border-stone-800/40 pb-6">
        {all.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveId(item.id);
              track('v5_mirror_pattern_tap', { label: item.label });
            }}
            className={`w-full border-b pb-3 text-left transition-colors duration-300 ${
              active?.id === item.id ? 'border-[#8b6b45]/40 text-stone-100' : 'border-stone-800/30 text-stone-500 hover:text-stone-300'
            }`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[15px] tracking-[0.05em]">{item.label}</span>
              <span className="text-[11px] tracking-[0.08em] text-stone-500">{item.current_count} 处</span>
            </div>
          </button>
        ))}
      </div>

      {active ? (
        <div className="pt-4">
          <p className="text-[11px] tracking-[0.16em] text-stone-500">{active._kind === 'pattern' ? '重复模式' : '生活领域'} · {active.dominant_sentiment}</p>
          <p className="mt-2 text-[12px] leading-7 tracking-[0.08em] text-stone-500">出现 {active.current_count} 次</p>
        </div>
      ) : null}
    </div>
  );
}

export default function MirrorPage() {
  const { book, markMirrorViewed, _hasHydrated: hasHydrated } = useFragmentStore();
  const observations = useWaysArchive((state) => state.observations);
  const waysHydrated = useWaysArchive((state) => state._hasHydrated);
  const [analysis, setAnalysis] = useState<MirrorAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  const completedPages = useMemo(() => book.pages.filter((page) => page.paragraphs.length > 0), [book.pages]);
  const completedPageCount = completedPages.length;
  const stage = useMemo(() => getBookmarkStage(completedPageCount), [completedPageCount]);
  const isBookmarkReady = completedPageCount > 0;
  const evidenceCards = useMemo(() => buildEvidenceCards(book.pages), [book.pages]);

  useEffect(() => {
    if (hasHydrated && completedPageCount > 0) {
      markMirrorViewed();
      track('v5_mirror_viewed', { completed_pages: completedPageCount });
    }
  }, [hasHydrated, completedPageCount, markMirrorViewed]);

  useEffect(() => {
    if (!hasHydrated || completedPages.length === 0) {
      setLoading(false);
      return;
    }
    const fragments = completedPages.map((page) => ({
      id: page.id,
      text: page.paragraphs.map((p) => p.text).filter(Boolean).join('\n'),
      title: page.title || undefined,
      createdAt: page.opened_at || undefined,
    }));
    setLoading(true);
    fetch('/api/book/mirror/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_fragments: fragments, previous_fragments: [] }),
    })
      .then((res) => res.json())
      .then((data) => setAnalysis(data))
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false));
  }, [hasHydrated, completedPages]);

  if (!hasHydrated) {
    return (
      <main className="min-h-dvh bg-[#120f0e]">
        <div className="flex h-dvh items-center justify-center">
          <p className="text-[11px] tracking-[0.18em] text-stone-600">加载中…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#120f0e] text-stone-100 selection:bg-stone-700 selection:text-stone-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_34%)]" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 py-6">
        <header className="shrink-0 border-b border-stone-800/40 pb-5">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/book"
              className="border-b border-dashed border-stone-700/60 pb-0.5 text-[11px] tracking-[0.18em] text-stone-500 transition-colors duration-500 hover:border-stone-400 hover:text-stone-200"
              onClick={() => track('v5_mirror_return')}
            >
              ← 回到书里
            </Link>
            <div className="text-right">
              <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600/60">{stage.title}</p>
            </div>
          </div>
        </header>

        <section className="min-h-0 flex-1 pt-6 pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={String(isBookmarkReady)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="flex h-full flex-col"
            >
              <div className="border border-[#8b6b45]/18 bg-[linear-gradient(180deg,rgba(34,27,23,0.92),rgba(21,17,15,0.96))] px-6 py-8 shadow-[0_24px_64px_rgba(0,0,0,0.24)]">
                <BookmarkProgressBar completedPages={completedPageCount} />

                {loading ? (
                  <div className="mt-8 text-center">
                    <p className="text-[18px] font-light tracking-[0.08em] text-stone-200">正在分析…</p>
                  </div>
                ) : analysis && analysis.patterns.length > 0 ? (
                  <div className="mt-8 text-center space-y-4">
                    <p className="text-[18px] font-light tracking-[0.08em] text-stone-200">
                      重复最多的模式：
                      {analysis.summary.top_patterns.slice(0, 3).map((p, i) => (
                        <span key={p.label}>
                          {i > 0 && '、'}{p.label}（{p.count}次）
                        </span>
                      ))}
                    </p>
                    <p className="text-[12px] leading-[1.9] tracking-[0.06em] text-stone-500/80">
                      全部 {analysis.patterns.length + analysis.life_areas.length} 个模式
                    </p>
                  </div>
                ) : (
                  <div className="mt-8 text-center">
                    <p className="text-[18px] font-light tracking-[0.08em] text-stone-200">已记录 {completedPageCount} 页，尚未形成足够多的重复模式。</p>
                    <p className="mt-4 text-[12px] leading-[1.9] tracking-[0.06em] text-stone-500/80">继续记录，当某个话题出现 2 次以上时会在这里显示。</p>
                  </div>
                )}

                <EvidenceSlips items={evidenceCards} />
              </div>

              {waysHydrated && observations.length > 0 ? (
                <div className="mt-8 border border-[#8b6b45]/18 bg-[linear-gradient(180deg,rgba(34,27,23,0.92),rgba(21,17,15,0.96))] px-6 py-7 shadow-[0_24px_64px_rgba(0,0,0,0.24)]">
                  <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600/60">观察方式 · 你留下的</p>
                  <p className="mt-3 text-[16px] font-light tracking-[0.08em] text-stone-200">
                    {observations.length === 1 ? '这是你留下的第一个观察。' : `你在这里留下了 ${observations.length} 个观察。`}
                  </p>
                  <div className="mt-6 space-y-5">
                    {observations.map((obs) => {
                      const lens = LENSES[obs.lensId];
                      return (
                        <div key={obs.id} className="border-t border-stone-800/55 pt-5">
                          <div className="flex items-baseline justify-between gap-4">
                            <p className="text-[11px] tracking-[0.14em] text-stone-500">
                              {lens?.label ?? obs.lensId} · {lens?.poetic ?? ''}
                            </p>
                            <p className="font-mono text-[10px] tracking-[0.16em] text-stone-600">{formatShortDate(obs.createdAt)}</p>
                          </div>
                          <p className="mt-2 text-[14px] font-light leading-7 tracking-[0.04em] text-stone-200">{obs.angle}</p>
                          <p className="mt-2 border-l border-stone-800 pl-3 text-[12px] font-light leading-6 tracking-[0.05em] text-stone-500">
                            “{compact(obs.fragment, 40)}”
                          </p>
                          {obs.userResponse ? (
                            <p className="mt-2 text-[12px] font-light leading-6 tracking-[0.05em] text-stone-500">你：{compact(obs.userResponse, 60)}</p>
                          ) : null}
                          {obs.landed ? (
                            <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-stone-600">
                              {obs.landed === 'new' ? '看见新的东西' : obs.landed === 'seen' ? '早就知道' : '说不清'}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {isBookmarkReady && analysis && (analysis.patterns.length > 0 || analysis.life_areas.length > 0) ? (
                <div className="mt-8 min-h-0 flex-1 overflow-hidden border-t border-stone-800/40 pt-6">
                  <PatternList patterns={analysis.patterns} lifeAreas={analysis.life_areas} />
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
