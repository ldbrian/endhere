'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from './_core/analytics';
import type { BookPage, LegacyPage, Paragraph } from './_core/storage';
import { useFragmentStore } from './_core/storage';
import { createWindowProvider } from './_core/windows';
import { getPersonaDefinition, normalizePersonaId } from './_core/personas';

const MIRROR_REQUIRED_PAGES = 5;

type MirrorBookmarkState = 'hidden' | 'normal' | 'has-new' | 'viewed';

function formatPageTimestamp(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function getPageTimestamp(page: BookPage) {
  const lastParagraph = page.paragraphs[page.paragraphs.length - 1];
  return formatPageTimestamp(lastParagraph?.timestamp || page.closed_at || page.opened_at);
}

function MirrorBookmark({ state }: { state: MirrorBookmarkState }) {
  if (state === 'hidden') return null;
  const isHasNew = state === 'has-new';
  const isViewed = state === 'viewed';
  return (
    <Link
      href="/v2/mirror"
      className="group relative z-30 flex cursor-pointer items-center"
      aria-label="书签"
      onClick={() => track('v4_mirror_bookmark_tap', { state })}
    >
      {/* The bookmark tab sticking out from the right edge of the card */}
      <div className={`relative flex translate-x-[2px] items-center justify-center transition-all duration-700 group-hover:scale-110 group-active:scale-95 ${isHasNew ? 'h-[84px] w-[42px]' : isViewed ? 'h-[62px] w-[30px]' : 'h-[56px] w-[28px]'}`}>
        {/* Glow behind bookmark on has-new */}
        {isHasNew ? (
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-2 rounded-full bg-[#9b7650]/20 blur-md"
          />
        ) : null}
        {/* Bookmark body — larger notch faces right (tab shape) */}
        <div
          className={`absolute inset-0 transition-all duration-500 ${
            isHasNew
              ? 'bg-[#b78b5b]/95 shadow-[0_0_28px_rgba(183,139,91,0.45)] group-hover:shadow-[0_0_38px_rgba(183,139,91,0.62)] group-hover:bg-[#c59663]'
              : isViewed
                ? 'bg-[#7b5d3d]/55 group-hover:bg-[#7b5d3d]/80 group-hover:shadow-[0_0_16px_rgba(123,93,61,0.3)]'
                : 'bg-[#6b4d30]/40 group-hover:bg-[#6b4d30]/70 group-hover:shadow-[0_0_14px_rgba(107,77,48,0.25)]'
          }`}
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 14%, 28% 50%, 100% 86%, 100% 100%, 0 100%)',
          }}
        />
        {/* First emergence — only when the first clear outline appears */}
        {isHasNew ? (
          <motion.span
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 ml-[-4px] h-[5px] w-[5px] rounded-full bg-[#ecd9b0]"
          />
        ) : null}
      </div>
    </Link>
  );
}

const PlasticBagIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={className}>
    <path d="M16 4h-8v-2h8v2zM6 4v16h12v-16M9 8v4M15 8v4" strokeLinecap="square" strokeLinejoin="miter" />
  </svg>
);

const ExpandIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={className}>
    <path d="M9 4H4v5" strokeLinecap="square" />
    <path d="M15 4h5v5" strokeLinecap="square" />
    <path d="M4 15v5h5" strokeLinecap="square" />
    <path d="M20 15v5h-5" strokeLinecap="square" />
    <path d="M10 4L4 10" strokeLinecap="square" />
    <path d="M14 4l6 6" strokeLinecap="square" />
    <path d="M4 14l6 6" strokeLinecap="square" />
    <path d="M20 14l-6 6" strokeLinecap="square" />
  </svg>
);

const CollapseIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={className}>
    <path d="M10 10H4V4" strokeLinecap="square" />
    <path d="M14 10h6V4" strokeLinecap="square" />
    <path d="M10 14H4v6" strokeLinecap="square" />
    <path d="M14 14h6v6" strokeLinecap="square" />
    <path d="M4 4l6 6" strokeLinecap="square" />
    <path d="M20 4l-6 6" strokeLinecap="square" />
    <path d="M4 20l6-6" strokeLinecap="square" />
    <path d="M20 20l-6-6" strokeLinecap="square" />
  </svg>
);

const PaperStackIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={className} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4h9l5 5v11H5z" />
    <path d="M14 4v5h5" />
    <path d="M8 12h7M8 16h7" />
  </svg>
);

function extractPageTitle(paragraphs: string[]) {
  const joined = paragraphs.join('').replace(/\s+/g, '').trim();
  if (!joined) return '';
  const cleaned = joined.replace(/[，。！？；：、…—「」『』""''（）《》【】,.!?;:'"()\[\]<>]/g, '');
  if (cleaned.length <= 12) return cleaned;
  for (let length = 12; length >= 6; length -= 1) {
    const slice = cleaned.slice(0, length).trim();
    if (slice.length >= 6) return slice;
  }
  return cleaned.slice(0, 8);
}

function formatPreviewText(text: string, limit: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit).trim() + '…';
}

function InstallBookmarkCard({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -12, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -1 }} exit={{ opacity: 0, y: -10, rotate: -2 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="absolute right-0 top-10 z-50 w-[280px]">
      <div className="relative overflow-hidden rounded-[4px] border border-[#8b6b45]/40 bg-[linear-gradient(180deg,#2a2119_0%,#1b1512_100%)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute left-4 top-0 h-5 w-8 rounded-b-[4px] bg-[#9b7650]/80" />
        <button type="button" onClick={onClose} className="absolute right-3 top-3 text-[11px] tracking-[0.12em] text-stone-500 transition-colors hover:text-stone-200 cursor-pointer" aria-label="关闭">收起</button>
        <p className="font-mono text-[10px] tracking-[0.24em] text-stone-600">INSTALL</p>
        <p className="mt-4 text-[14px] font-light leading-7 tracking-[0.05em] text-stone-200">把 EndHere 收进你的口袋，随时翻开。</p>
        <div className="mt-5 space-y-3 border-t border-stone-700/20 pt-4 text-[12px] leading-6 tracking-[0.04em] text-stone-400">
          <p>1. 点击浏览器底部 [分享] / [更多] 菜单</p>
          <p>2. 选择「添加到主屏幕 / 安装应用」</p>
          <p>3. 从桌面打开，像 App 一样使用。</p>
        </div>
      </div>
    </motion.div>
  );
}

function PageAxis({ pages, currentPageIndex, onSelect }: { pages: BookPage[]; currentPageIndex: number; onSelect: (index: number) => void }) {
  const first = pages[0]?.page_number ?? '001';
  const last = pages[pages.length - 1]?.page_number ?? '001';
  return (
    <div className="flex items-center gap-4 text-stone-500/74">
      <span className="font-mono text-[10px] tracking-[0.24em] text-stone-600/70">{first}</span>
      <div className="relative flex items-center gap-[7px] rounded-full border border-stone-800/60 bg-stone-950/18 px-3 py-2 backdrop-blur-sm">
        <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-stone-800/55" />
        {pages.map((page, index) => {
          const distance = Math.abs(index - currentPageIndex);
          const isActive = index === currentPageIndex;
          const isNear = distance === 1;
          return (
            <button key={page.id} type="button" onClick={() => onSelect(index)} className="group relative z-10 flex h-6 w-3 items-center justify-center cursor-pointer" aria-label={'跳转到第 ' + page.page_number + ' 页'}>
              <motion.span layout transition={{ type: 'spring', stiffness: 420, damping: 28 }} className={`block rounded-full transition-colors duration-300 ${isActive ? 'bg-stone-200 shadow-[0_0_12px_rgba(231,229,228,0.28)]' : isNear ? 'bg-stone-500/80 group-hover:bg-stone-400' : 'bg-stone-700/75 group-hover:bg-stone-500/90'}`} style={{ width: isActive ? 4 : 2, height: isActive ? 24 : isNear ? 16 : 12, opacity: isActive ? 1 : isNear ? 0.82 : 0.58 }} />
            </button>
          );
        })}
      </div>
      <span className="font-mono text-[10px] tracking-[0.24em] text-stone-600/70">{last}</span>
    </div>
  );
}

function Cover({ hasContent, onOpen }: { hasContent: boolean; onOpen: () => void }) {
  return (
    <motion.section initial={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.015, filter: 'blur(6px)' }} transition={{ duration: 1.08, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 z-50 flex items-center justify-center bg-[#0b0908] px-6">
      <div className="relative flex min-h-[80vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[8px] border border-[#4d3a29]/60 bg-[linear-gradient(180deg,#2b2118_0%,#17110e_58%,#100d0c_100%)] px-10 py-12 shadow-[0_40px_140px_rgba(0,0,0,0.68)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(237,202,148,0.09),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%,transparent_78%,rgba(0,0,0,0.22))]" />
        <div className="pointer-events-none absolute inset-[12px] border border-[#7b5d3d]/18" />
        <div className="pointer-events-none absolute inset-x-[28px] top-[38px] h-px bg-gradient-to-r from-transparent via-[#a78860]/20 to-transparent" />
        <div className="pointer-events-none absolute inset-x-[28px] bottom-[38px] h-px bg-gradient-to-r from-transparent via-[#a78860]/16 to-transparent" />
        <div className="flex-1" />
        
        {/* 👇 修改了这部分 👇 */}
        <div className="relative z-10 text-center">
          <p className="mb-10 text-[10px] tracking-[0.42em] text-stone-500/60">THE LIVING BOOK</p>
          <h1 className="text-[36px] font-light tracking-[0.18em] text-stone-100">ENDHERE</h1>
          <p className="mt-9 text-[15px] font-light tracking-[0.08em] text-stone-300/88">这是一本属于你的书</p>
          <p className="mt-3 text-[12px] font-light tracking-[0.06em] text-stone-500/70">它会随着你留下的页面，慢慢拥有自己的模样</p>
        </div>
        {/* 👆 修改了这部分 👆 */}

        <div className="flex-1" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="pointer-events-none absolute -inset-x-16 -inset-y-8 bg-[radial-gradient(ellipse_at_center,rgba(237,202,148,0.32),transparent_64%)] blur-xl" />
          <button type="button" onClick={onOpen} className="group relative overflow-hidden rounded-full border border-[#c9a86a]/45 bg-[linear-gradient(180deg,rgba(237,202,148,0.16),rgba(180,140,80,0.06))] px-9 py-3 text-[13px] tracking-[0.26em] text-[#ecd9b0] shadow-[0_0_28px_rgba(237,202,148,0.38),inset_0_0_14px_rgba(237,202,148,0.18)] transition-all duration-500 hover:border-[#ecd9b0]/70 hover:text-stone-50 hover:shadow-[0_0_44px_rgba(237,202,148,0.6),inset_0_0_18px_rgba(237,202,148,0.3)] cursor-pointer">
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,248,228,0.22)_50%,transparent_70%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
            <span className="relative">{hasContent ? '继续' : '翻开第一页'}</span>
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function ReadingNote({ page }: { page: BookPage }) {
  const latestParagraph = page.paragraphs[page.paragraphs.length - 1];
  if (!latestParagraph?.shopkeeper_comment && !latestParagraph?.trace) return null;
  const content = latestParagraph.shopkeeper_comment || latestParagraph.trace;
  const personaName = latestParagraph.persona ? getPersonaDefinition(normalizePersonaId(latestParagraph.persona)).name : 'Echo';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.5 }} className="mt-5 border-t border-stone-700/12 pt-3">
      <p className="mb-1 text-[9px] tracking-[0.18em] text-stone-500/60">{personaName}</p>
      <p className="text-[11px] leading-[1.8] tracking-[0.03em] text-stone-400/80">{formatPreviewText(content, 88)}</p>
    </motion.div>
  );
}

function ExpandedPage({ page, onClose }: { page: BookPage; onClose: () => void }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/72 px-6 py-8" onClick={onClose}><motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="relative h-full max-h-[88vh] w-full max-w-[760px] overflow-hidden rounded-[6px] border border-stone-700/45 bg-[#181412] shadow-[0_30px_80px_rgba(0,0,0,0.45)]" onClick={(event) => event.stopPropagation()}><button type="button" onClick={onClose} className="absolute right-5 top-5 z-30 flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/10 hover:text-stone-100 cursor-pointer" aria-label="收起"><CollapseIcon className="h-[18px] w-[18px]" /></button><div className="pointer-events-none absolute inset-[12px] border border-stone-700/14" /><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_40%),linear-gradient(180deg,rgba(255,248,236,0.028),transparent_18%,transparent_84%,rgba(0,0,0,0.16))]" /><div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.5%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.015%22/%3E%3C/svg%3E')] opacity-30" /><div className="relative z-10 flex h-full cursor-default flex-col overflow-y-auto px-10 pb-14 pt-14 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="mb-10 text-center"><p className="font-mono text-[17px] tracking-[0.34em] text-stone-400">{page.page_number}</p>{page.title ? <p className="mt-3 text-[13px] tracking-[0.08em] text-stone-500">{page.title}</p> : null}</div><div className="divide-y divide-stone-700/15">{page.paragraphs.map((paragraph) => <p key={paragraph.id} className="whitespace-pre-wrap py-5 text-[16px] font-light leading-[2.15] tracking-[0.04em] text-stone-300 first:pt-0 last:pb-0">{paragraph.text}</p>)}</div><ReadingNote page={page} />{getPageTimestamp(page) ? <div className="mt-8 border-t border-stone-700/12 pt-4 text-center"><p className="font-mono text-[10px] tracking-[0.18em] text-stone-500/65">{getPageTimestamp(page)}</p></div> : null}</div></motion.div></motion.div>;
}

function LegacyArchiveOverlay({ archive, onClose }: { archive: LegacyPage[]; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-5 py-8" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 12 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-full max-h-[86vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[6px] border border-[#6b5439]/50 bg-[linear-gradient(180deg,#2a221a_0%,#1c1612_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 纸张质感：泛黄、纹理、毛边 */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(217,180,120,0.07),transparent_45%),linear-gradient(180deg,rgba(210,175,120,0.04),transparent_20%,transparent_80%,rgba(0,0,0,0.22))]" />
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.6%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.03%22/%3E%3C/svg%3E')] opacity-40" />
        <div className="pointer-events-none absolute inset-[10px] border border-[#7b5d3d]/16" />

        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/10 hover:text-stone-100 cursor-pointer" aria-label="收起">
          <CollapseIcon className="h-[16px] w-[16px]" />
        </button>

        <div className="relative z-10 flex h-full cursor-default flex-col overflow-y-auto px-8 pb-14 pt-12 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mb-8 text-center">
            <p className="text-[9px] tracking-[0.32em] text-stone-500/60">PAST PAGES</p>
            <p className="mt-3 text-[13px] font-light tracking-[0.1em] text-stone-300/80">从这里之前，写过的每一页</p>
          </div>

          {archive.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[12px] font-light leading-[2] tracking-[0.06em] text-stone-500/50">还没有旧页可翻。</p>
            </div>
          ) : (
            <div className="space-y-7">
              {archive.map((page) => (
                <div key={page.id} className="relative rounded-[3px] border border-[#5d4631]/30 bg-[#221b15]/60 px-6 py-5">
                  {/* 旧纸张折角 */}
                  <div className="pointer-events-none absolute -right-px -top-px h-5 w-5 border-l border-b border-[#5d4631]/30 bg-[linear-gradient(135deg,transparent_50%,rgba(0,0,0,0.25)_50%)]" />
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-mono text-[12px] tracking-[0.3em] text-stone-500/70">{page.page_number}</span>
                    {page.title ? <span className="text-[10px] tracking-[0.08em] text-stone-500/60">{page.title}</span> : null}
                  </div>
                  {page.paragraphs.map((paragraph, index) => (
                    <div key={index} className={index > 0 ? 'border-t border-stone-700/12 pt-5 mt-5' : ''}>
                      <p className="whitespace-pre-wrap text-[14px] font-light leading-[2] tracking-[0.04em] text-stone-300/85">{paragraph.text}</p>
                      {paragraph.trace ? (
                        <div className="mt-3 pt-2">
                          <p className="mb-0.5 text-[9px] tracking-[0.18em] text-stone-500/50">{paragraph.persona ? getPersonaDefinition(normalizePersonaId(paragraph.persona)).name : 'Echo'}</p>
                          <p className="whitespace-pre-wrap text-[12px] font-light leading-[1.75] tracking-[0.03em] text-stone-400/70">{paragraph.trace}</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

const FIRST_PAGE_DEFAULT_TEXT = '今天我第一次翻开这本书';
const FIRST_PAGE_CEREMONIAL_NARRATION = '所有的故事都从翻开第一页开始。这页纸上的墨迹还未干，但书已经知道——它等到了属于自己的读者。从这一刻起，每一页都将因你而不同。';
const BLANK_PAGE_INVITATION = '在这里写下此刻的心情…';

// 提交一页后的中间状态：idle → saving（已保存）→ generating（生成中）→ idle（揭晓）
type SubmitPhase = 'idle' | 'saving' | 'generating';

// 桌面端（精细指针）能用原生光标；触屏设备受浏览器安全策略限制，无法程序唤起键盘，只能用合成光标兜底
function detectFinePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: fine)').matches ?? false;
}

function PageCard({ page, promptText, isLatestPage, submitPhase, finePointer, onAddParagraph, onExpand, onPersonaPreference, onRegenerateResponse, isRegenerating }: { page: BookPage; promptText: string; isLatestPage: boolean; submitPhase: SubmitPhase; finePointer: boolean; onAddParagraph: (text: string) => void; onExpand: () => void; onPersonaPreference: (persona: string, delta: 1 | -1) => void; onRegenerateResponse: (pageId: string, paragraphId: string, originalText: string, currentPersona: string) => void; isRegenerating: boolean; }) {
  const isFirstBlankPage = page.page_number === '001' && page.paragraphs.length === 0;
  const defaultText = isFirstBlankPage ? FIRST_PAGE_DEFAULT_TEXT : '';
  const [inputText, setInputText] = useState(defaultText);
  const [isFocused, setIsFocused] = useState(false);
  const [liked, setLiked] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const textMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [cursorX, setCursorX] = useState(0);
  // 最后一页且无内容且非提交中时才可写；有内容（已 finalize）即锁定
  const isWritable = isLatestPage && page.paragraphs.length === 0 && submitPhase === 'idle';
  const showPrompt = isWritable && promptText.trim().length > 0;
  const paragraph = page.paragraphs[0];
  useEffect(() => {
    const defaultText = page.page_number === '001' ? FIRST_PAGE_DEFAULT_TEXT : '';
    setInputText(defaultText);
    setIsFocused(false);
    setLiked(false);
  }, [page.id, page.page_number]);

  // Reset liked when response changes (e.g. after regeneration)
  useEffect(() => {
    setLiked(false);
  }, [paragraph?.trace]);
  // Measure text width for synthetic cursor positioning (触屏兜底用)
  useEffect(() => {
    if (textMeasureRef.current) {
      setCursorX(textMeasureRef.current.offsetWidth);
    }
  }, [inputText, isFocused]);
  // Auto-focus and place cursor at end of default text (works on desktop / fine pointer)
  useEffect(() => {
    if (isWritable && finePointer && inputRef.current) {
      const attemptFocus = () => {
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
          const len = inputRef.current?.value.length ?? 0;
          inputRef.current?.setSelectionRange(len, len);
        }
      };
      const t1 = setTimeout(attemptFocus, 200);
      const t2 = setTimeout(attemptFocus, 600);
      const t3 = setTimeout(attemptFocus, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [isWritable, finePointer, page.id]);
  const commitInput = () => { const trimmed = inputText.trim(); if (!trimmed || submitPhase !== 'idle') return; onAddParagraph(trimmed); setInputText(''); setIsFocused(false); };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); commitInput(); } };

  return (
    <div className="relative h-full w-full cursor-default select-none">
      {/* Bookmark ribbon */}
      <div className="pointer-events-none absolute left-3 top-5 h-0 w-0 border-b-[22px] border-l-[16px] border-r-[16px] border-l-transparent border-r-transparent border-b-[#8f6f52]/82 opacity-84" />

      {/* Card body */}
      <div className="relative h-full w-full overflow-hidden rounded-[6px] border border-[#5d4631]/55 bg-[#181412] shadow-[0_28px_90px_rgba(0,0,0,0.55)] before:pointer-events-none before:absolute before:inset-y-[24px] before:left-[-10px] before:w-[14px] before:rounded-full before:bg-stone-950/18 before:blur-md">
        {/* Decorative inner border */}
        <div className="pointer-events-none absolute inset-[12px] border border-stone-700/14" />
        {/* Light gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_42%),linear-gradient(180deg,rgba(255,248,236,0.03),transparent_16%,transparent_84%,rgba(0,0,0,0.16))]" />
        {/* Paper noise texture */}
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.5%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.013%22/%3E%3C/svg%3E')] opacity-25" />
        {/* Left edge shadow (spine) */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-[18px] bg-gradient-to-r from-stone-950/18 to-transparent" />
        {/* Right edge shadow */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[20px] bg-gradient-to-l from-stone-950/30 to-transparent" />

        {/* Expand button (only on filled pages) */}
        {paragraph ? (
          <button type="button" onClick={onExpand} className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-full text-stone-500/60 transition-colors hover:bg-stone-200/10 hover:text-stone-100 cursor-pointer" aria-label="展开全屏">
            <ExpandIcon className="h-[15px] w-[15px]" />
          </button>
        ) : null}

        {/* Content area */}
        <div className="relative z-10 flex h-full flex-col px-10 pb-6 pt-9">
          {/* Page number & title */}
          <div className="shrink-0 text-center">
            <p className="font-mono text-[14px] tracking-[0.34em] text-stone-400">{page.page_number}</p>
            {page.title ? <p className="mt-1.5 text-[11px] tracking-[0.08em] text-stone-500">{page.title}</p> : null}
          </div>

          {/* Main content area */}
          <div className="mt-4 flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {paragraph ? (
                /* ── Filled page: text from top-left ── */
                <div className="flex flex-col">
                  <p className="whitespace-pre-wrap text-[14px] font-light leading-[2] tracking-[0.04em] text-stone-300">
                    {paragraph.text}
                  </p>
                  {paragraph.trace ? (
                    <div className="mt-5 border-t border-stone-700/12 pt-3">
                      <p className="mb-1 text-[9px] tracking-[0.18em] text-stone-500/55">
                        {paragraph.persona ? getPersonaDefinition(normalizePersonaId(paragraph.persona)).name : 'Echo'}
                      </p>
                      <p className={`whitespace-pre-wrap text-[12px] font-light leading-[1.75] tracking-[0.03em] text-stone-400/75 transition-opacity duration-300 ${isRegenerating ? 'opacity-40' : ''}`}>
                        {paragraph.trace}
                      </p>
                      {/* P1-3: Preference buttons — hidden on ceremonial first page */}
                      {paragraph.trace !== FIRST_PAGE_CEREMONIAL_NARRATION ? (
                        <div className="mt-3 flex items-center gap-6">
                          <button
                            type="button"
                            onClick={() => {
                              if (liked) return;
                              setLiked(true);
                              const persona = paragraph.persona || 'Echo';
                              onPersonaPreference(persona, 1);
                              track('v4_persona_liked', { persona });
                            }}
                            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${liked ? 'text-[#c9a86c]/80' : 'text-stone-500/50 hover:text-[#c9a86c]/70'}`}
                            aria-label="喜欢这个回应"
                          >
                            <span className="text-[15px]">{liked ? '♥' : '♡'}</span>
                            <span className="text-[11px] tracking-[0.06em]">喜欢</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isRegenerating) return;
                              const persona = paragraph.persona || 'Echo';
                              onRegenerateResponse(page.id, paragraph.id, paragraph.text, persona);
                            }}
                            disabled={isRegenerating}
                            className={`flex items-center gap-1.5 transition-colors ${isRegenerating ? 'text-stone-600/30 cursor-wait' : 'text-stone-500/50 hover:text-stone-300/70 cursor-pointer'}`}
                            aria-label="换一种回应"
                          >
                            <motion.span
                              animate={isRegenerating ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                              transition={isRegenerating ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
                              style={{ display: 'inline-block' }}
                              className="text-[15px]"
                            >↻</motion.span>
                            <span className="text-[11px] tracking-[0.06em]">换一个</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : submitPhase !== 'idle' ? (
                    /* 中间状态：已保存 → 正在生成回应。文案克制，符合世界观，不用工程化语言 */
                    <div className="mt-5 border-t border-stone-700/12 pt-3">
                      {submitPhase === 'saving' ? (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5 }}
                          className="text-[11px] font-light leading-[1.8] tracking-[0.06em] text-stone-500/70"
                        >
                          这一页被保存了下来。
                        </motion.p>
                      ) : (
                        <motion.p
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                          className="text-[11px] font-light leading-[1.8] tracking-[0.06em] text-stone-500"
                        >
                          书正在接住这一页…
                        </motion.p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : isWritable ? (
                /* ── Blank writable page: inviting cursor ── */
                <div className="flex h-full flex-col">
                  {showPrompt ? (
                    <p
                      className="mb-4 whitespace-pre-wrap text-[13px] font-light leading-[1.85] tracking-[0.04em] text-stone-500/50"
                    >
                      {promptText}
                    </p>
                  ) : null}
                  <div className="relative z-10 flex-1 cursor-default">
                    {/* Hidden measurement span for cursor positioning */}
                    <span
                      ref={textMeasureRef}
                      aria-hidden
                      className="pointer-events-none absolute left-0 top-0 invisible whitespace-pre text-[14px] font-light leading-[2] tracking-[0.04em]"
                    >
                      {inputText}
                    </span>
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(event) => setInputText(event.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder={isFirstBlankPage ? '' : BLANK_PAGE_INVITATION}
                      className={`min-h-[80px] w-full resize-none bg-transparent text-[14px] font-light leading-[2] tracking-[0.04em] outline-none ${isWritable ? 'caret-stone-300' : 'caret-transparent'} text-stone-300 placeholder:text-stone-600/35`}
                      rows={4}
                      autoFocus={isWritable}
                    />
                    {/* Synthetic blinking cursor — only on touch devices where native cursor can't be programmatically shown, and only when writable */}
                    {!isFocused && !finePointer && isWritable ? (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                        className="pointer-events-none absolute top-[3px] inline-block h-[18px] w-[1.5px] rounded-full bg-[#c9a86c]/70"
                        style={{ left: `${cursorX}px` }}
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={commitInput}
                    disabled={!inputText.trim() || submitPhase !== 'idle'}
                    className={`mt-3 shrink-0 self-center rounded-full border px-5 py-1.5 text-[12px] tracking-[0.16em] transition-all duration-300 cursor-pointer ${
                      inputText.trim() && submitPhase === 'idle'
                        ? 'border-[#c9a86c]/40 bg-[linear-gradient(180deg,rgba(237,202,148,0.12),rgba(180,140,80,0.04))] text-[#ecd9b0] shadow-[0_0_16px_rgba(237,202,148,0.18)] hover:border-[#ecd9b0]/60 hover:shadow-[0_0_28px_rgba(237,202,148,0.32)]'
                        : 'border-stone-700/25 text-stone-600/40 cursor-not-allowed'
                    }`}
                  >
                    写下这一页
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Finished page hint */}
          {isLatestPage && !isWritable && paragraph && submitPhase === 'idle' ? (
            <div className="mt-3 shrink-0 text-center">
              <p className="text-[10px] tracking-[0.16em] text-stone-600/40">这一页已经写完，向右翻到下一页</p>
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}

export default function V2HomePage() {
  const [coverDismissed, setCoverDismissed] = useState(false);
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle');
  const [finePointer, setFinePointer] = useState(false);
  const [regeneratingPageId, setRegeneratingPageId] = useState<string | null>(null);
  const currentWindow = useMemo(() => createWindowProvider().peekWindow(), []);
  const { book, legacyArchive, currentPageIndex, setCurrentPageIndex, openLatestPage, appendParagraphToCurrentPage, finalizeCurrentPage, setParagraphResponse, applyPageTitle, pendingTitleTask, markOpened, ensureTrailingBlankPage, mirrorViewedAt, adjustPersonaPreference, personaPreferences, _hasHydrated: hasHydrated } = useFragmentStore();
  const currentPage = useMemo(() => book.pages[Math.max(0, Math.min(currentPageIndex, book.pages.length - 1))], [book.pages, currentPageIndex]);
  const hasContent = useMemo(() => book.pages.some((page) => page.paragraphs.length > 0), [book.pages]);
  const shouldShowCover = hasHydrated && !coverDismissed;
  // 书签 / 照见状态
  const completedPageCount = useMemo(() => book.pages.filter((page) => page.paragraphs.length > 0).length, [book.pages]);
  const mirrorBookmarkState = useMemo<MirrorBookmarkState>(() => {
    if (completedPageCount < 1) return 'hidden'; // no pages at all, don't show bookmark
    if (completedPageCount < MIRROR_REQUIRED_PAGES) return 'normal'; // 还没到第一次照见，但书签已经存在
    // Has enough pages — check if there's new content since last view
    const lastPageClosedAt = book.pages.filter((p) => p.paragraphs.length > 0).pop()?.closed_at;
    if (!mirrorViewedAt) return 'has-new'; // 第一次自己露出来
    if (lastPageClosedAt && new Date(lastPageClosedAt).getTime() > mirrorViewedAt) return 'has-new'; // 这段时间的样子又多露出来一点
    return 'viewed';
  }, [completedPageCount, mirrorViewedAt, book.pages]);
  // Safety net: ensure there's always a blank page at the end
  useEffect(() => { if (hasHydrated) ensureTrailingBlankPage(); }, [hasHydrated, ensureTrailingBlankPage, book.pages.length]);
  useEffect(() => { if (!pendingTitleTask) return; const title = extractPageTitle(pendingTitleTask.paragraphs); if (!title) return; applyPageTitle(pendingTitleTask.pageId, title); }, [applyPageTitle, pendingTitleTask]);
  const handleOpenBook = () => { markOpened(); openLatestPage(); window.setTimeout(() => setCoverDismissed(true), 220); };
  // 检测精细指针（桌面）：决定是否能用程序化 focus 唤起原生光标
  useEffect(() => { setFinePointer(detectFinePointer()); }, []);

  // 一页一碎片 · 两段式：先保存（这一页被保存了下来）→ 再生成回应 → 揭晓 → 停留当前页，轴上出现空白下一页
  const handleAddParagraph = async (text: string) => {
    if (submitPhase !== 'idle') return;
    const isCeremonialFirstPage = text === FIRST_PAGE_DEFAULT_TEXT;
    const targetPageId = book.pages[Math.max(0, Math.min(currentPageIndex, book.pages.length - 1))]?.id;
    const targetPageIndex = currentPageIndex;

    // ── 第一段：立即落盘原文（narration 暂空），让用户看到「这一页被保存了下来」──
    setSubmitPhase('saving');
    const { paragraph } = appendParagraphToCurrentPage({
      title: '',
      original_content: text,
      narration_content: '',
      visibility: 'private',
      allow_shopkeeper_review: false,
      consent_level: 1,
    });
    // 让「已保存」呼吸约一秒，再进入生成
    await new Promise((resolve) => window.setTimeout(resolve, 1000));

    // ── 第二段：生成回应（仪式首页文案跳过 API；其余走 organize）──
    setSubmitPhase('generating');
    let title = '';
    let narration = '';
    let persona;
    let artifact;
    if (isCeremonialFirstPage) {
      title = '第一页';
      narration = FIRST_PAGE_CEREMONIAL_NARRATION;
    } else {
      try {
        const response = await fetch('/api/v2/fragments/organize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ original_content: text, persona_preferences: personaPreferences }),
        });
        if (response.ok) {
          const data = await response.json();
          title = String(data.title || '').trim();
          narration = String(data.narration_content || '').trim();
          persona = normalizePersonaId(data.persona);
          if (data.artifact && typeof data.artifact.emoji === 'string' && typeof data.artifact.name === 'string') {
            artifact = { emoji: String(data.artifact.emoji).trim(), name: String(data.artifact.name).trim() };
          }
        }
      } catch {
        // 网络失败：留空 response，页面仍然成立
      }
    }

    // ── 揭晓：把回应写回刚才那段，然后封页（停留当前页，不跳转）──
    if (targetPageId) {
      setParagraphResponse(targetPageId, paragraph.id, { narration, persona, artifact });
    }
    const result = finalizeCurrentPage({ title, stayOnCurrentPage: true });
    // 停留模式下 currentPageIndex 不变，但确保它指向刚写完的那一页（防御性）
    if (targetPageIndex !== currentPageIndex) setCurrentPageIndex(targetPageIndex);
    if (result) {
      track('v4_page_turned', { closed_page_number: result.closedPage.page_number, next_page_number: result.nextPage.page_number });
    }
    setSubmitPhase('idle');
  };
  const handleRegenerateResponse = async (pageId: string, paragraphId: string, originalText: string, currentPersona: string) => {
    adjustPersonaPreference(currentPersona, -1);
    track('v4_persona_retry', { persona: currentPersona });
    setRegeneratingPageId(pageId);
    try {
      const currentPreferences = useFragmentStore.getState().personaPreferences;
      const response = await fetch('/api/v2/fragments/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_content: originalText, persona_preferences: currentPreferences }),
      });
      if (response.ok) {
        const data = await response.json();
        const narration = String(data.narration_content || '').trim();
        const persona = normalizePersonaId(data.persona);
        let artifact;
        if (data.artifact && typeof data.artifact.emoji === 'string' && typeof data.artifact.name === 'string') {
          artifact = { emoji: String(data.artifact.emoji).trim(), name: String(data.artifact.name).trim() };
        }
        setParagraphResponse(pageId, paragraphId, { narration, persona, artifact });
      }
    } catch {
      // silent fail — keep current response
    }
    setRegeneratingPageId(null);
  };
  const handlePrev = () => { if (submitPhase !== 'idle') return; if (currentPageIndex <= 0) return; setCurrentPageIndex(currentPageIndex - 1); };
  const handleNext = () => { if (submitPhase !== 'idle') return; if (currentPageIndex >= book.pages.length - 1) return; setCurrentPageIndex(currentPageIndex + 1); };
  useEffect(() => { if (!hasHydrated || !hasContent || coverDismissed) return; const timer = window.setTimeout(() => handleOpenBook(), 2000); return () => window.clearTimeout(timer); }, [hasHydrated, hasContent, coverDismissed]);
  const expandedPage = expandedPageId ? book.pages.find((page) => page.id === expandedPageId) || null : null;
  if (!hasHydrated) return <main className="min-h-screen bg-[#110f0e]" />;
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col overflow-hidden bg-[#120f0e] font-sans text-stone-200 shadow-[0_0_120px_rgba(0,0,0,0.5)] sm:border-x sm:border-stone-900/60 [caret-color:transparent]">
      <AnimatePresence>{shouldShowCover ? <Cover hasContent={hasContent} onOpen={handleOpenBook} /> : null}</AnimatePresence>
      <AnimatePresence>{expandedPage ? <ExpandedPage page={expandedPage} onClose={() => setExpandedPageId(null)} /> : null}</AnimatePresence>
      <AnimatePresence>{showLegacy ? <LegacyArchiveOverlay archive={legacyArchive} onClose={() => setShowLegacy(false)} /> : null}</AnimatePresence>

      {/* Ambient light overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(251,191,36,0.05),transparent_28%),linear-gradient(180deg,rgba(255,248,236,0.02),transparent_24%,transparent_78%,rgba(0,0,0,0.28))]" />
      {/* Center spine shadow */}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-[26px] -translate-x-1/2 bg-gradient-to-r from-black/0 via-stone-950/18 to-black/0 blur-[1px]" />

      {/* Header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3 text-stone-500/80">
          <img src="/logo.png" alt="Logo" className="h-[24px] w-auto object-contain opacity-45 grayscale" />
          <span className="text-[11px] tracking-[0.18em] text-stone-500/70">EndHere</span>
        </div>
        <div className="pointer-events-auto relative flex items-center gap-4">
          <button type="button" onClick={() => setShowLegacy(true)} className="outline-none cursor-pointer" aria-label="旧纸张">
            <PaperStackIcon className="h-5 w-5 text-stone-500/80 transition-colors hover:text-stone-300" />
          </button>
          <button type="button" onClick={() => setShowInstallCard((value) => !value)} className="outline-none cursor-pointer" aria-label="安装说明">
            <PlasticBagIcon className="h-5 w-5 text-stone-500/80 transition-colors hover:text-stone-300" />
          </button>
          <AnimatePresence>{showInstallCard ? <InstallBookmarkCard onClose={() => setShowInstallCard(false)} /> : null}</AnimatePresence>
        </div>
      </header>

      {/* Page axis */}
      <div className="relative z-20 mt-20 flex items-center justify-center px-4">
        <PageAxis pages={book.pages} currentPageIndex={currentPageIndex} onSelect={setCurrentPageIndex} />
      </div>

      {/* Card + Arrows layout: arrows outside the card */}
      <div className="relative flex w-full flex-1 items-center justify-center py-5">
        <div className="flex w-full items-center">
          {/* Left arrow */}
          <div className="flex w-11 shrink-0 items-center justify-center">
            {currentPageIndex > 0 ? (
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500/50 transition-all duration-300 hover:scale-110 hover:bg-stone-200/8 hover:text-stone-200 cursor-pointer" onClick={handlePrev} aria-label="上一页">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
            ) : null}
          </div>

          {/* Card container — narrower, centered */}
          <div className="min-h-0 flex-1">
            <div className="relative mx-auto h-[64vh] max-h-[680px] w-full max-w-[370px]">
              {/* Mirror bookmark — sticks out from the right edge of the card */}
              <div className="pointer-events-auto absolute right-0 top-[22%] z-40 translate-x-[calc(100%-2px)]">
                <MirrorBookmark state={mirrorBookmarkState} />
              </div>
              {/* Static background card — always visible so page + bookmark never disappear during transitions */}
              <div className="absolute inset-0 rounded-[6px] border border-[#5d4631]/55 bg-[#181412] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
                <div className="pointer-events-none absolute inset-[12px] border border-stone-700/14" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_42%),linear-gradient(180deg,rgba(255,248,236,0.03),transparent_16%,transparent_84%,rgba(0,0,0,0.16))]" />
                <div className="pointer-events-none absolute left-0 top-0 h-full w-[18px] bg-gradient-to-r from-stone-950/18 to-transparent" />
                <div className="pointer-events-none absolute right-0 top-0 h-full w-[20px] bg-gradient-to-l from-stone-950/30 to-transparent" />
                {/* Watermark: logo + EndHere — visible on the static background card during transitions */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-[0.06]">
                  <img src="/logo.png" alt="" className="h-[36px] w-auto object-contain" />
                  <span className="text-[18px] font-light tracking-[0.18em] text-stone-300">EndHere</span>
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={currentPage.id} initial={{ opacity: 0, x: 24, y: 8, scale: 0.985 }} animate={{ opacity: shouldShowCover ? 0.12 : 1, x: 0, y: 0, scale: shouldShowCover ? 0.992 : 1 }} exit={{ opacity: 0, x: -20, y: 6, scale: 0.988 }} transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0">
                  <PageCard page={currentPage} promptText={currentWindow.text} isLatestPage={currentPageIndex === book.pages.length - 1} submitPhase={submitPhase} finePointer={finePointer} onAddParagraph={handleAddParagraph} onExpand={() => setExpandedPageId(currentPage.id)} onPersonaPreference={adjustPersonaPreference} onRegenerateResponse={handleRegenerateResponse} isRegenerating={regeneratingPageId === currentPage.id} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right arrow */}
          <div className="flex w-11 shrink-0 items-center justify-center">
            {currentPageIndex < book.pages.length - 1 ? (
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500/50 transition-all duration-300 hover:scale-110 hover:bg-stone-200/8 hover:text-stone-200 cursor-pointer" onClick={handleNext} aria-label="下一页">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
