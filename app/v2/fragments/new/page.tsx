'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  clampNarrationToOriginal,
  fallbackFragmentTitle,
  normalizeFragmentText,
  type FragmentPersonaId,
} from '../../_core/fragments';
import { useFragmentStore } from '../../_core/storage';
import { pickArtifactLineArt } from '../../_core/artifacts';
import { normalizePersonaId } from '../../_core/personas';
import { findWindowByText, getWindowIndex, type WindowItem } from '../../_core/windows';
import { track } from '../../../lib/track';

type Step = 'writing' | 'tracing' | 'saved';

type OrganizedPage = {
  title: string;
  trace: string;
  artifact: { emoji: string; name: string };
  persona: FragmentPersonaId;
};

const ORIGINAL_CONTENT_LIMIT = 700;

function createWindowTelemetry(windowItem: WindowItem | null) {
  if (!windowItem) return { entry: 'free' };
  return {
    entry: 'window',
    window_index: getWindowIndex(windowItem),
    window_level: windowItem.level,
    window_language: windowItem.language,
  };
}

function fallbackOrganizedPage(original: string): OrganizedPage {
  return {
    title: fallbackFragmentTitle(original),
    trace: clampNarrationToOriginal('这一页被轻轻折了一角。', original),
    artifact: { emoji: '📎', name: '一枚旧回形针' },
    persona: 'Echo',
  };
}

function V2NewFragmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedWindowText = searchParams.get('window')?.trim() || '';
  const entryMode = searchParams.get('entry');
  const entryWindow = useMemo(() => {
    if (entryMode !== 'window' || !requestedWindowText) return null;
    return findWindowByText(requestedWindowText);
  }, [entryMode, requestedWindowText]);
  const addLocalFragment = useFragmentStore((state) => state.addLocalFragment);
  const [step, setStep] = useState<Step>('writing');
  const [content, setContent] = useState('');
  const [organized, setOrganized] = useState<OrganizedPage | null>(null);
  const [error, setError] = useState('');
  const original = normalizeFragmentText(content);

  const writePage = async () => {
    if (!original) {
      setError('这一页还没有字。');
      return;
    }

    setError('');
    if (entryWindow) track('v4_book_window_written', createWindowTelemetry(entryWindow));
    setStep('tracing');

    try {
      const response = await fetch('/api/v2/fragments/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_content: original }),
      });

      if (!response.ok) throw new Error('trace failed');
      const data = await response.json();
      const artifact = data.artifact && typeof data.artifact.emoji === 'string' && typeof data.artifact.name === 'string'
        ? { emoji: String(data.artifact.emoji).trim(), name: String(data.artifact.name).trim() }
        : { emoji: '📎', name: '一枚旧回形针' };

      setOrganized({
        title: String(data.title || fallbackFragmentTitle(original)).trim(),
        trace: clampNarrationToOriginal(String(data.narration_content || ''), original),
        artifact,
        persona: normalizePersonaId(data.persona),
      });
    } catch {
      setOrganized(fallbackOrganizedPage(original));
    }
  };

  const savePage = () => {
    const safePage = organized || fallbackOrganizedPage(original);
    addLocalFragment({
      title: safePage.title,
      original_content: original,
      narration_content: safePage.trace,
      visibility: 'private',
      allow_shopkeeper_review: false,
      ai_persona: safePage.persona,
      consent_level: 1,
      artifact: safePage.artifact,
    });
    track('v4_book_page_saved', createWindowTelemetry(entryWindow));
    setStep('saved');
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#1B1614] text-stone-100 selection:bg-stone-700 selection:text-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.035),transparent_34%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-7 pb-9 pt-7">
        <header className="flex shrink-0 items-center justify-between">
          <Link href="/v2" className="border-b border-transparent pb-1 text-[11px] tracking-[0.16em] text-stone-500 transition-colors duration-500 hover:border-stone-700 hover:text-stone-300">
            合上
          </Link>
          <span className="font-mono text-[10px] tracking-[0.24em] text-stone-600">TODAY PAGE</span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-8">
          <AnimatePresence mode="wait">
            {step === 'writing' && (
              <motion.div
                key="writing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.42 }}
              >
                <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600">写下今天这一页</p>

                {entryWindow && (
                  <div className="mt-8 border-l border-stone-800/80 pl-4">
                    <p className="text-[13px] font-light leading-8 tracking-[0.08em] text-stone-500">
                      {entryWindow.text}
                    </p>
                  </div>
                )}

                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={entryWindow ? '从这一页往下写。' : '一句话，也是一页。'}
                  className="mt-8 min-h-[220px] w-full resize-none border-y border-stone-800/70 bg-transparent py-8 text-[19px] font-light leading-10 tracking-[0.04em] text-stone-100 outline-none placeholder:text-stone-700 focus:ring-0"
                  maxLength={ORIGINAL_CONTENT_LIMIT}
                  autoFocus
                />
                <div className="mt-7 flex items-center justify-between gap-6">
                  <span className="font-mono text-[10px] tracking-[0.14em] text-stone-600">{original.length}/{ORIGINAL_CONTENT_LIMIT}</span>
                  <button
                    type="button"
                    onClick={writePage}
                    disabled={!original}
                    className="text-[13px] tracking-[0.18em] text-stone-200 transition-colors duration-500 hover:text-white disabled:text-stone-600"
                  >
                    留在这里
                  </button>
                </div>
                {error && <p className="mt-6 text-[12px] tracking-[0.1em] text-stone-500">{error}</p>}
              </motion.div>
            )}

            {step === 'tracing' && organized === null && (
              <motion.div key="tracing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                <div className="mx-auto mb-8 h-2 w-2 rounded-full bg-stone-500 animate-pulse" />
                <p className="text-[14px] tracking-[0.16em] text-stone-400">这本书正在留下痕迹</p>
                <p className="mt-6 text-[11px] tracking-[0.12em] text-stone-600">不会改写你的原文。</p>
              </motion.div>
            )}

            {step === 'tracing' && organized && (
              <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.42 }}>
                <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600">PAGE TRACE</p>
                <div className="mt-8 border-y border-stone-800/80 py-8">
                  <p className="whitespace-pre-wrap text-[19px] font-light leading-10 tracking-[0.05em] text-stone-100">{original}</p>
                </div>
                {organized.trace && (
                  <div className="mt-8 border-l border-stone-800 pl-4">
                    <p className="text-[12px] font-light leading-7 tracking-[0.06em] text-stone-500">{organized.trace}</p>
                  </div>
                )}
                {organized.artifact && (() => {
                  const LineArt = pickArtifactLineArt(organized.artifact);
                  return (
                    <div className="mt-8 flex items-center gap-3 text-stone-500">
                      <LineArt className="h-8 w-8 shrink-0 text-stone-500/80" />
                      <span className="text-[12px] font-light tracking-[0.08em] text-stone-500">{organized.artifact.name}</span>
                    </div>
                  );
                })()}
                <div className="mt-12 flex items-center justify-between">
                  <button type="button" onClick={() => setStep('writing')} className="text-[12px] tracking-[0.16em] text-stone-500 transition-colors duration-500 hover:text-stone-300">
                    重新写
                  </button>
                  <button type="button" onClick={savePage} className="text-[13px] tracking-[0.18em] text-stone-300 transition-colors duration-500 hover:text-white">
                    放进书里
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'saved' && (
              <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600">PAGE KEPT</p>
                <p className="mt-8 max-w-[300px] whitespace-pre-wrap text-[20px] font-light leading-10 tracking-[0.05em] text-stone-100">{original}</p>
                <p className="mt-8 text-[13px] font-light tracking-[0.1em] text-stone-500">这一页已经留在书里。</p>
                <div className="mt-12 flex items-center justify-center gap-8">
                  <button type="button" onClick={() => router.push('/v2')} className="text-[12px] tracking-[0.16em] text-stone-500 transition-colors duration-500 hover:text-stone-300">
                    回到今天
                  </button>
                  <button type="button" onClick={() => router.push('/v2/nostalgia')} className="text-[12px] tracking-[0.16em] text-stone-300 transition-colors duration-500 hover:text-white">
                    翻看书页
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}

export default function V2NewFragmentPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#1B1614]" />}>
      <V2NewFragmentContent />
    </Suspense>
  );
}