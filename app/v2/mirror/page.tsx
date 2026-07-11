'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from '../_core/analytics';
import { useFragmentStore } from '../_core/storage';
import { MirrorTopicPanel } from '../_core/MirrorTopicPanel';

const BOOKMARK_STAGES = [
  {
    min: 0,
    max: 2,
    title: '第一次照见',
    body: '这本书还只认出一个很淡的轮廓。',
    hint: '页数还少，线索也少，所以现在只能看见一点模糊的样子。',
  },
  {
    min: 3,
    max: 5,
    title: '第一次照见',
    body: '这几页里，有些东西开始反复出现了。',
    hint: '书还没法把它说清，但已经能隐约照出一点你这段时间的样子。',
  },
  {
    min: 6,
    max: 14,
    title: '这一段时间的样子',
    body: '线索多了一些，轮廓也开始更稳一点。',
    hint: '其中有些线索会留下来，有些会被后面的页修正掉。',
  },
  {
    min: 15,
    max: Infinity,
    title: '这一段时间的样子',
    body: '这本书现在能更忠实地照出：这一段时间，你留在这里的样子。',
    hint: '它不是“真正的你”。它只是这一段时间，被这些书页留下来的你。',
  },
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
        <span>线索正在累积</span>
        <span>{completedPages} / {target}</span>
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

export default function V2MirrorPage() {
  const { book, markMirrorViewed, _hasHydrated: hasHydrated } = useFragmentStore();
  const completedPages = useMemo(() => book.pages.filter((page) => page.paragraphs.length > 0), [book.pages]);
  const completedPageCount = completedPages.length;
  const stage = useMemo(() => getBookmarkStage(completedPageCount), [completedPageCount]);
  const isBookmarkReady = completedPageCount >= 15;
  const evidenceCards = useMemo(() => buildEvidenceCards(book.pages), [book.pages]);

  useEffect(() => {
    if (hasHydrated && completedPageCount > 0) {
      markMirrorViewed();
      track('v4_mirror_viewed', { completedPageCount });
    }
  }, [hasHydrated, completedPageCount, markMirrorViewed]);

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
              href="/v2"
              className="border-b border-dashed border-stone-700/60 pb-0.5 text-[11px] tracking-[0.18em] text-stone-500 transition-colors duration-500 hover:border-stone-400 hover:text-stone-200"
              onClick={() => track('v4_mirror_back_to_book_tap')}
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

                <div className="mt-8 text-center">
                  <p className="text-[18px] font-light tracking-[0.08em] text-stone-200">{stage.body}</p>
                  <p className="mt-4 text-[12px] leading-[1.9] tracking-[0.06em] text-stone-500/80">{stage.hint}</p>
                </div>

                <EvidenceSlips items={evidenceCards} />
              </div>

              {isBookmarkReady ? (
                <div className="mt-8 min-h-0 flex-1 overflow-hidden border-t border-stone-800/40 pt-6">
                  <MirrorTopicPanel embedded />
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
