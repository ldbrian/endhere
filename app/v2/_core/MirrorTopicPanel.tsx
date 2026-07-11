'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from './analytics';
import type { BookPage } from './storage';
import { useFragmentStore } from './storage';

type BookmarkCoordinateKind = 'OBJECT' | 'LOCATION' | 'ACTION' | 'TIME';

type BookmarkCoordinateRule = {
  kind: BookmarkCoordinateKind;
  label: string;
  words: string[];
};

type BookmarkPageRef = {
  id: string;
  pageNumber: string;
  title: string;
  openedAt: string;
  excerpt: string;
  fullText: string;
  quote: string;
};

type BookmarkGroup = {
  id: string;
  label: string;
  kind: BookmarkCoordinateKind;
  reason: string[];
  pages: BookmarkPageRef[];
};

const COORDINATE_RULES: BookmarkCoordinateRule[] = [
  { kind: 'TIME', label: '深夜', words: ['深夜', '凌晨', '半夜', '夜里'] },
  { kind: 'TIME', label: '下班后', words: ['下班', '收工', '回去路上'] },
  { kind: 'LOCATION', label: '便利店', words: ['便利店', '小卖部', '全家', '7-11'] },
  { kind: 'LOCATION', label: '路上', words: ['路上', '地铁', '公交', '路口', '电梯'] },
  { kind: 'LOCATION', label: '家里', words: ['家里', '客厅', '卧室', '厨房'] },
  { kind: 'OBJECT', label: '雨伞', words: ['雨伞', '伞'] },
  { kind: 'OBJECT', label: '手机', words: ['手机', '屏幕', '消息'] },
  { kind: 'OBJECT', label: '杯子', words: ['杯子', '咖啡', '热水'] },
  { kind: 'ACTION', label: '等待', words: ['等', '等待', '排队', '迟迟', '没来'] },
  { kind: 'ACTION', label: '赶路', words: ['赶', '赶路', '跑过去', '追', '冲'] },
  { kind: 'ACTION', label: '停住', words: ['停住', '停下', '站着', '发呆'] },
  { kind: 'ACTION', label: '回头看', words: ['回头', '回看', '又看了一眼'] },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '——';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function compactText(value: string, max = 72) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function pickQuote(fullText: string, words: string[]) {
  const sentences = splitIntoSentences(fullText);
  const hitSentence = sentences.find((sentence) => words.some((word) => sentence.toLowerCase().includes(word.toLowerCase())));
  if (hitSentence) return compactText(hitSentence, 42);

  const lines = fullText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const hitLine = lines.find((line) => words.some((word) => line.toLowerCase().includes(word.toLowerCase())));
  if (hitLine) return compactText(hitLine, 42);

  return compactText(sentences[0] || lines[0] || fullText.trim(), 42);
}

function pageText(page: BookPage) {
  return page.paragraphs.map((paragraph) => paragraph.text).filter(Boolean).join('\n');
}

function toBookmarkPages(pages: BookPage[]): BookmarkPageRef[] {
  return pages
    .filter((page) => page.paragraphs.length > 0)
    .map((page) => {
      const fullText = pageText(page);
      return {
        id: page.id,
        pageNumber: page.page_number,
        title: page.title,
        openedAt: page.opened_at,
        excerpt: compactText(fullText, 72),
        fullText,
        quote: '',
      };
    });
}

function pageMatches(page: BookmarkPageRef, words: string[]) {
  const content = (page.title + '\n' + page.fullText).toLowerCase();
  return words.some((word) => content.includes(word.toLowerCase()));
}

function buildBookmarkGroups(pages: BookmarkPageRef[]): BookmarkGroup[] {
  return COORDINATE_RULES.map((rule) => {
    const matchedPages = pages
      .filter((page) => pageMatches(page, rule.words))
      .map((page) => ({ ...page, quote: pickQuote(page.fullText, rule.words) }));
    return {
      id: `${rule.kind}:${rule.label}`,
      label: rule.label,
      kind: rule.kind,
      reason: [rule.label],
      pages: matchedPages,
    };
  })
    .filter((group) => group.pages.length >= 2)
    .sort((a, b) => b.pages.length - a.pages.length)
    .slice(0, 5);
}

function stageTitle(groupCount: number) {
  if (groupCount <= 0) return '第一次照见';
  return '这一段时间的样子';
}

function kindLabel(kind: BookmarkCoordinateKind) {
  if (kind === 'OBJECT') return '反复留下的东西';
  if (kind === 'LOCATION') return '反复经过的地方';
  if (kind === 'ACTION') return '反复出现的动作';
  return '反复出现的时间';
}

export function MirrorTopicPanel({ embedded = false }: { embedded?: boolean }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const book = useFragmentStore((state) => state.book);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);
  const pages = useMemo(() => toBookmarkPages(book.pages), [book.pages]);
  const groups = useMemo(() => buildBookmarkGroups(pages), [pages]);
  const activeGroup = groups.find((group) => group.id === activeLabel) || groups[0] || null;

  if (!hasHydrated) {
    return (
      <div className={embedded ? 'flex h-full items-center justify-center' : 'min-h-dvh bg-[#1B1614] px-7 py-12 text-stone-100'}>
        <p className="text-[11px] tracking-[0.18em] text-stone-600">加载中…</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className={embedded ? 'flex h-full flex-col justify-center' : 'min-h-dvh bg-[#1B1614] px-7 py-12 text-stone-100'}>
        <p className="font-mono text-[10px] tracking-[0.24em] text-stone-600">这一段时间的样子</p>
        <p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-stone-300">书里还没有留下足够的线索。</p>
      </div>
    );
  }

  if (groups.length === 0) return <MirrorQuietState embedded={embedded} />;

  return (
    <div className={embedded ? 'h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'min-h-dvh bg-[#1B1614] px-7 py-12 text-stone-100'}>
      <div className="border-b border-stone-900/80 pb-5">
        <p className="font-mono text-[10px] tracking-[0.24em] text-stone-600">{stageTitle(groups.length)}</p>
        <p className="mt-4 text-[16px] font-light leading-8 tracking-[0.08em] text-stone-200">这段时间，你留在这本书里的样子，开始慢慢清楚了。</p>
        <p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-stone-500">它不是定义，也不是结论。只是这段时间里，反复留下来的线索。</p>
      </div>

      {activeGroup ? (
        <>
          <section className="border-b border-stone-900/80 py-7">
            <p className="text-[11px] tracking-[0.16em] text-stone-500">{kindLabel(activeGroup.kind)}</p>
            <p className="mt-4 text-[17px] font-light tracking-[0.06em] text-stone-100">{activeGroup.reason.join(' · ')}</p>
            <p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-stone-500">这些线索在几页里反复出现过，所以这一段时间的样子，先从这里被照出来一点。</p>
          </section>

          <section className="py-6">
            <div className="space-y-3 border-b border-stone-900/80 pb-6">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setActiveLabel(group.id);
                    track('v4_mirror_group_tap', { label: group.label });
                  }}
                  className={`w-full border-b pb-3 text-left transition-colors duration-300 ${activeGroup.id === group.id ? 'border-[#8b6b45]/40 text-stone-100' : 'border-stone-900/70 text-stone-500 hover:text-stone-300'}`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[15px] tracking-[0.05em]">{group.label}</span>
                    <span className="text-[11px] tracking-[0.08em] text-stone-500">{group.pages.length} 处证据</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <AnimatePresence mode="wait">
            <motion.section
              key={activeGroup.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="overflow-hidden pb-9 pt-2"
            >
              <div className="mb-4">
                <p className="text-[12px] leading-7 tracking-[0.08em] text-stone-500">先看到的是这些原句。页码和标题只是来源，不是主角。</p>
              </div>
              <div className="space-y-5">
                {activeGroup.pages.slice(0, 3).map((page) => (
                  <article key={page.id} className="border-b border-stone-900/70 pb-4">
                    <p className="whitespace-pre-wrap text-[15px] font-light leading-8 tracking-[0.04em] text-stone-200">“{page.quote}”</p>
                    <div className="mt-3 flex items-center gap-3 text-[10px] tracking-[0.14em] text-stone-500/80">
                      <span>第 {page.pageNumber} 页</span>
                      <span>·</span>
                      <span>{formatDate(page.openedAt)}</span>
                      
                    </div>
                  </article>
                ))}
              </div>
            </motion.section>
          </AnimatePresence>
        </>
      ) : null}
    </div>
  );
}

function MirrorQuietState({ embedded }: { embedded: boolean }) {
  return (
    <div className={embedded ? 'flex h-full flex-col justify-center' : 'min-h-dvh bg-[#1B1614] px-7 py-12 text-stone-100'}>
      <div className="border-b border-stone-900/80 pb-5">
        <p className="font-mono text-[10px] tracking-[0.24em] text-stone-600">第一次照见</p>
        <p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-stone-300">轮廓还很淡。</p>
        <p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-stone-500">线索还少，所以它现在只能照出一点模糊的样子。</p>
      </div>
    </div>
  );
}

