'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { pickArtifactLineArt } from '../_core/artifacts';
import { TraceMark } from '../_core/TraceMark';
import type { Fragment } from '../_core/fragments';
import { useFragmentStore } from '../_core/storage';

function getPageTime(fragment: Fragment) {
  return fragment.created_at || fragment.updated_at || new Date(0).toISOString();
}

function formatPageDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未明';
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatPageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function groupByPageDate(fragments: Fragment[]) {
  const sorted = [...fragments].sort((a, b) => new Date(getPageTime(b)).getTime() - new Date(getPageTime(a)).getTime());
  const groups = new Map<string, Fragment[]>();

  sorted.forEach((fragment) => {
    const label = formatPageDate(getPageTime(fragment));
    const items = groups.get(label) || [];
    items.push(fragment);
    groups.set(label, items);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function PageTraceArtifact({ fragment }: { fragment: Fragment }) {
  const artifact = fragment.meta?.artifact;
  if (!artifact) return null;
  const LineArt = pickArtifactLineArt(artifact);

  return (
    <div className="mt-6 flex items-center gap-3 text-stone-500">
      <LineArt className="h-7 w-7 shrink-0 text-stone-500/80" />
      <p className="min-w-0 text-[12px] font-light leading-6 tracking-[0.08em] text-stone-500">{artifact.name}</p>
    </div>
  );
}

function BookPage({ fragment, index }: { fragment: Fragment; index: number }) {
  const createdAt = getPageTime(fragment);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.035, 0.24) }}
      className="relative border-l border-stone-800/80 pb-14 pl-6 last:pb-4"
    >
      <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border border-stone-700 bg-[#1B1614]" />
      <time className="font-mono text-[10px] tracking-[0.18em] text-stone-600" dateTime={createdAt}>
        {formatPageTime(createdAt)}
      </time>
      <p className="mt-5 whitespace-pre-wrap text-[19px] font-light leading-[1.9] tracking-[0.04em] text-stone-100">
        {fragment.original_content}
      </p>
      <TraceMark text={fragment.narration_content} createdAt={createdAt} />
      <PageTraceArtifact fragment={fragment} />
    </motion.article>
  );
}

export default function NostalgiaPage() {
  const localFragments = useFragmentStore((state) => state.localFragments);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);
  const groups = useMemo(() => groupByPageDate(localFragments), [localFragments]);

  if (!hasHydrated) return <div className="fixed inset-0 bg-[#1B1614]" />;

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center bg-[#1B1614] text-stone-100 selection:bg-stone-700 selection:text-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_100%)] bg-[34px_100%]" />
      <header className="absolute left-0 right-0 top-0 z-30 flex h-24 items-center justify-center bg-gradient-to-b from-[#1B1614] via-[#1B1614]/90 to-transparent">
        <div className="flex w-full max-w-[520px] items-center justify-between px-7">
          <Link href="/book" className="border-b border-transparent pb-1 text-[11px] tracking-[0.16em] text-stone-500 outline-none transition-colors duration-500 hover:border-stone-700 hover:text-stone-300">
            回到今天
          </Link>
          <span className="font-mono text-[10px] tracking-[0.24em] text-stone-600">PAGES</span>
        </div>
      </header>

      <div className="relative z-10 flex w-full max-w-[520px] flex-1 flex-col overflow-y-auto px-7 pb-28 pt-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[13px] font-light leading-8 tracking-[0.12em] text-stone-500">这本书还没有写下第一页。</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label} className="pb-4">
                <div className="sticky top-0 z-10 -mx-7 mb-7 bg-gradient-to-b from-[#1B1614] via-[#1B1614]/95 to-transparent px-7 pb-4 pt-1">
                  <h2 className="font-mono text-[10px] tracking-[0.22em] text-stone-600">{group.label}</h2>
                </div>
                {group.items.map((fragment, index) => (
                  <BookPage key={fragment.id} fragment={fragment} index={index} />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}