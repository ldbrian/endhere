'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from './analytics';
import type { BookPage } from './storage';
import { useFragmentStore } from './storage';

type MirrorPageRef = {
  id: string;
  pageNumber: string;
  title: string;
  openedAt: string;
  excerpt: string;
  fullText: string;
};

type MirrorGroup = {
  label: string;
  pages: MirrorPageRef[];
};

const MIRROR_RULES: { label: string; words: string[] }[] = [
  { label: '疲惫', words: ['累', '疲惫', '困了', '撑住'] },
  { label: '物件', words: ['钥匙', '手机', '杯子', '背包', '钱包', '雨伞'] },
  { label: '深夜便利店', words: ['深夜', '便利店', '凌晨', '睡不着觉'] },
  { label: '通勤路上', words: ['地铁', '公交', '骑车', '堵车', '通勤', '赶路'] },
  { label: '无奈', words: ['又', '还', '算了', '没办法', '不得不'] },
  { label: '焦虑', words: ['担心', '焦虑', '压力', '烦', '睡不着'] },
  { label: '孤单', words: ['独', '一个人走', '没有人在', '孤零零的'] },
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

function pageText(page: BookPage) {
  return page.paragraphs.map((paragraph) => paragraph.text).filter(Boolean).join('\n');
}

function toMirrorPages(pages: BookPage[]): MirrorPageRef[] {
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
      };
    });
}

function pageMatches(page: MirrorPageRef, words: string[]) {
  const content = (page.title + '\n' + page.fullText).toLowerCase();
  return words.some((word) => content.includes(word.toLowerCase()));
}

function buildMirrorGroups(pages: MirrorPageRef[]): MirrorGroup[] {
  return MIRROR_RULES.map((rule) => ({
    label: rule.label,
    pages: pages.filter((page) => pageMatches(page, rule.words)),
  }))
    .filter((group) => group.pages.length >= 2)
    .sort((a, b) => b.pages.length - a.pages.length)
    .slice(0, 5);
}

export function MirrorTopicPanel({ embedded = false }: { embedded?: boolean }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const book = useFragmentStore((state) => state.book);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);
  const pages = useMemo(() => toMirrorPages(book.pages), [book.pages]);
  const groups = useMemo(() => buildMirrorGroups(pages), [pages]);
  const activeGroup = groups.find((group) => group.label === activeLabel) || null;

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
        <p className="font-mono text-[10px] tracking-[0.24em] text-stone-600">MIRROR</p>
        <p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-stone-300">镜中还看不到你的书页。</p>
      </div>
    );
  }

  if (groups.length === 0) return <MirrorQuietState embedded={embedded} />;

  return (
    <div className={embedded ? 'h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'min-h-dvh bg-[#1B1614] px-7 py-12 text-stone-100'}>
      <div className="border-b border-stone-900/80 pb-5">
        <p className="font-mono text-[10px] tracking-[0.24em] text-stone-600">MIRROR</p>
      </div>

      <section className="border-b border-stone-900/80 py-7">
        <p className="text-[15px] font-light leading-8 tracking-[0.1em] text-stone-300">最近这些反复出现。</p>
        <p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-stone-500">它们只是证据，不是结论。</p>
      </section>

      <section className="py-6">
        <div className="grid gap-3">
          {groups.map((group) => (
            <button
              key={group.label}
              type="button"
              onClick={() => {
                setActiveLabel(activeLabel === group.label ? null : group.label);
                track('v4_mirror_group_tap', { label: group.label });
              }}
              className={(activeLabel === group.label ? 'border-stone-600 bg-stone-950/55' : 'border-stone-900/70 bg-stone-950/25 hover:border-stone-700') + ' flex items-baseline justify-between gap-5 border px-5 py-4 text-left transition-colors duration-500'}
            >
              <span className="text-[18px] font-light tracking-[0.08em] text-stone-100">{group.label}</span>
              <span className="shrink-0 text-[12px] tracking-[0.08em] text-stone-500">{group.pages.map((page) => page.pageNumber).join(' / ')}</span>
            </button>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {activeGroup ? (
          <motion.section
            key={activeGroup.label}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="overflow-hidden border-t border-stone-900/80 pb-9 pt-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="font-mono text-[10px] tracking-[0.2em] text-stone-600">{activeGroup.label}</p>
              <button
                type="button"
                onClick={() => setActiveLabel(null)}
                className="border-b border-dashed border-stone-800 pb-1 text-[10px] tracking-[0.14em] text-stone-600 transition-colors hover:border-stone-500 hover:text-stone-400"
              >
                收起
              </button>
            </div>

            <div className="grid gap-5">
              {activeGroup.pages.map((page) => (
                <article key={page.id} className="border-l border-stone-800 pl-4">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-stone-600">
                    {page.pageNumber} / {formatDate(page.openedAt)}
                  </p>
                  {page.title ? <p className="mt-2 text-[13px] tracking-[0.06em] text-stone-400">{page.title}</p> : null}
                  <p className="mt-3 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.05em] text-stone-300">{page.excerpt}</p>
                </article>
              ))}
            </div>

            <p className="mt-8 text-[14px] font-light tracking-[0.08em] text-stone-400">你有没有发现？</p>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MirrorQuietState({ embedded }: { embedded: boolean }) {
  return (
    <div className={embedded ? 'flex h-full flex-col justify-center' : 'min-h-dvh bg-[#1B1614] px-7 py-12 text-stone-100'}>
      <div className="border-b border-stone-900/80 pb-5">
        <p className="font-mono text-[10px] tracking-[0.24em] text-stone-600">MIRROR</p>
        <p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-stone-300">还没有东西反复出现。</p>
        <p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-stone-500">等它们自己浮现。</p>
      </div>
    </div>
  );
}