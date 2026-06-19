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
  type FragmentVisibility,
} from '../../_core/fragments';
import { useFragmentStore } from '../../_core/storage';

type Step = 'input' | 'organizing' | 'confirm' | 'permissions' | 'saved';

type OrganizedFragment = {
  title: string;
  narration_content: string;
};

const INSPIRATION = ['一个情绪', '一段回忆', '一件旧物', '一句话'];
const ORIGINAL_CONTENT_LIMIT = 350;
const ENTRY_PLACEHOLDERS = [
  '今天哪一瞬间，你觉得只剩自己一个人？',
  '写下一个你再也见不到的人的名字，和那天发生的事。',
  '凌晨三点，你在为什么醒着？',
  '哪句话你一直没有机会说出口？',
  '今天有什么东西，轻轻刺了你一下？',
  '如果这一天只留下一帧画面，会是什么？',
  '你最近一次假装没事，是因为什么？',
];
const AI_PERSONAS: { id: FragmentPersonaId; name: string; sub: string }[] = [
  { id: 'Ash', name: 'Ash', sub: '冷一点' },
  { id: 'Rin', name: 'Rin', sub: '轻一点' },
  { id: 'Child', name: '8岁的自己', sub: '近一点' },
];

function createReceiptId() {
  return `Fragment_#${Date.now().toString().slice(-4)}`;
}

function playReceiptClick() {
  if (typeof window === 'undefined') return;

  try {
    const audioContextCtor: typeof window.AudioContext | undefined =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!audioContextCtor) return;

    const context = new audioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(520, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.06);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  } catch {
    // Audio is ornamental; ignore browser autoplay or context failures.
  }
}

function V2NewFragmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addLocalFragment = useFragmentStore((state) => state.addLocalFragment);
  const [step, setStep] = useState<Step>('input');
  const [originalContent, setOriginalContent] = useState('');
  const [organized, setOrganized] = useState<OrganizedFragment | null>(null);
  const [visibility, setVisibility] = useState<FragmentVisibility>('private');
  const [allowShopkeeperReview, setAllowShopkeeperReview] = useState(false);
  const [aiPersona, setAiPersona] = useState<FragmentPersonaId>('Rin');
  const [error, setError] = useState('');
  const awakenQuote = useMemo(() => {
    const from = searchParams.get('from');
    const quote = searchParams.get('quote')?.trim() || '';
    return from === 'exhibit' && quote ? quote : '';
  }, [searchParams]);
  const [placeholder] = useState(() => ENTRY_PLACEHOLDERS[Math.floor(Math.random() * ENTRY_PLACEHOLDERS.length)]);
  const [receiptId, setReceiptId] = useState(() => createReceiptId());
  const activePlaceholder = awakenQuote ? '它让你想起了哪一刻？' : placeholder;
  const isAwakenedFromExhibit = awakenQuote.length > 0;

  const original = normalizeFragmentText(originalContent);
  const lastSubmitTime = useFragmentStore((state) => state.lastSubmitTime);
  const setLastSubmitTime = useFragmentStore((state) => state.setLastSubmitTime);

  const organize = async () => {
    if (!original) {
      setError('先留下一点内容。');
      return;
    }
    // 🟢 CTO 防刷拦截：60秒冷却期
    if (lastSubmitTime && Date.now() - lastSubmitTime < 60000) {
      const remain = Math.ceil((60000 - (Date.now() - lastSubmitTime)) / 1000);
      setError(`档案员正在整理案卷，请 ${remain} 秒后再来。`);
      return;
    }

    setError('');
    setStep('organizing');

    try {
      const response = await fetch('/api/v2/fragments/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_content: original, persona: aiPersona }),
      });

      if (!response.ok) throw new Error('organize failed');

      const data = await response.json();
      setOrganized({
        title: String(data.title || fallbackFragmentTitle(original)).trim(),
        narration_content: clampNarrationToOriginal(String(data.narration_content || ''), original),
      });
    } catch {
      setOrganized({
        title: fallbackFragmentTitle(original),
        narration_content: clampNarrationToOriginal('它被安静地留在这里。', original),
      });
    } finally {
      setStep('confirm');
    }
  };

  const save = () => {
    const safeOrganized = organized || {
      title: fallbackFragmentTitle(original),
      narration_content: '',
    };

    addLocalFragment({
      title: safeOrganized.title,
      original_content: original,
      narration_content: safeOrganized.narration_content,
      visibility,
      allow_shopkeeper_review: allowShopkeeperReview,
      ai_persona: aiPersona,
    });

    // 🟢 CTO 修复：在这里加锁！记录最后一次成功提交的时间
    setLastSubmitTime(Date.now());
    setReceiptId(createReceiptId());
    playReceiptClick();

    setStep('saved');
  };

  const saveReceiptImage = async () => {
    const node = document.getElementById('v2-fragment-receipt');
    if (!node) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(node, {
        background: '#101010',
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${receiptId.replace('#', '')}.png`;
      anchor.click();
    } catch (error) {
      console.error('[Fragment Receipt] save image failed:', error);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#101010] text-zinc-100 selection:bg-zinc-700 selection:text-zinc-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.045),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.024)_0%,transparent_40%,rgba(255,255,255,0.014)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-7 pb-10 pt-9">
        <header className="flex shrink-0 items-center justify-between">
          <Link href="/v2" className="text-[11px] tracking-[0.18em] text-zinc-500 transition-colors duration-500 hover:text-zinc-200">
            返回
          </Link>
          <span className="text-[10px] tracking-[0.24em] text-zinc-500">NEW FRAGMENT</span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait">
            {step === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45 }}
              >
                <p className="text-[13px] leading-8 tracking-[0.1em] text-zinc-400">你可以留下：</p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-[13px] tracking-[0.1em] text-zinc-300">
                  {INSPIRATION.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <p className="mt-8 text-[13px] tracking-[0.08em] text-zinc-500">所有体验都值得被记录。</p>

                {/* 🟢 CDO 修复：移除所有 border，增加聚焦时的微弱文字发光效应，强调空间感 */}
                {isAwakenedFromExhibit && (
                  <div className="mt-10 border-l border-zinc-800 pl-5">
                    <p className="text-[11px] leading-6 tracking-[0.14em] text-zinc-500">
                      刚才那块碎片让你想起：
                    </p>
                    <p className="mt-4 text-[13px] font-light leading-7 tracking-[0.06em] text-zinc-400">
                      {awakenQuote}
                    </p>
                  </div>
                )}

                <textarea
                  value={originalContent}
                  onChange={(event) => setOriginalContent(event.target.value)}
                  placeholder={activePlaceholder}
                  className="mt-12 h-32 w-full resize-none border-none bg-transparent pb-4 text-[15px] font-light leading-8 tracking-[0.08em] text-zinc-100 outline-none placeholder:text-zinc-600 focus:ring-0 focus:drop-shadow-[0_0_8px_rgba(255,255,255,0.12)]"
                  maxLength={ORIGINAL_CONTENT_LIMIT}
                  autoFocus
                />

                <div className="mt-8 grid grid-cols-3 gap-2">
                  {AI_PERSONAS.map((persona) => {
                    const active = aiPersona === persona.id;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => setAiPersona(persona.id)}
                        className={`min-h-16 border px-2 py-3 text-center transition-colors duration-300 outline-none ${
                          active
                            ? 'border-zinc-500 bg-zinc-900/70 text-zinc-100'
                            : 'border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                      >
                        <span className="block text-[12px] leading-5 tracking-[0.08em]">{persona.name}</span>
                        <span className="mt-1 block text-[10px] leading-4 tracking-[0.1em] opacity-70">{persona.sub}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-7 flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.14em] text-zinc-500">{original.length}/{ORIGINAL_CONTENT_LIMIT}</span>
                  <button
                    onClick={organize}
                    disabled={!original}
                    className="text-[13px] tracking-[0.18em] text-zinc-200 transition-colors duration-500 hover:text-white disabled:text-zinc-600"
                  >
                    交给 {AI_PERSONAS.find((persona) => persona.id === aiPersona)?.name}
                  </button>
                </div>
                {error && <p className="mt-6 text-[11px] tracking-[0.12em] text-red-900/80">{error}</p>}
              </motion.div>
            )}

            {step === 'organizing' && (
              <motion.div key="organizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                <div className="mx-auto mb-8 h-2 w-2 rounded-full bg-zinc-500 animate-pulse" />
                <p className="text-[14px] tracking-[0.16em] text-zinc-400">{AI_PERSONAS.find((persona) => persona.id === aiPersona)?.name} 正在看这块碎片</p>
                <p className="mt-6 text-[11px] tracking-[0.12em] text-zinc-500">不会改写你的原文。</p>
              </motion.div>
            )}

            {step === 'confirm' && organized && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45 }}
                className="max-h-[calc(100dvh-96px)] overflow-y-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <span className="text-[10px] tracking-[0.24em] text-zinc-500">归档确认</span>
                <h1 className="mt-6 text-[24px] font-light leading-10 tracking-[0.08em] text-zinc-100">
                  {organized.title}
                </h1>

                <div className="mt-10 border-l border-zinc-800 pl-5">
                  <p className="text-[11px] tracking-[0.2em] text-zinc-500">用户原文</p>
                  <p className="mt-5 whitespace-pre-wrap text-[15px] font-light leading-8 tracking-[0.06em] text-zinc-300">
                    {original}
                  </p>
                </div>

                <div className="mt-10 border-l border-zinc-800 pl-5">
                  <p className="text-[11px] tracking-[0.2em] text-zinc-500">
                    {AI_PERSONAS.find((persona) => persona.id === aiPersona)?.name} 留下的一句
                  </p>
                  <p className="mt-5 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.06em] text-zinc-400">
                    {organized.narration_content || '这块碎片暂时不需要旁白。'}
                  </p>
                </div>

                <div className="mt-12 flex items-center justify-between">
                  <button onClick={() => setStep('input')} className="text-[12px] tracking-[0.16em] text-zinc-500 transition-colors duration-500 hover:text-zinc-300">
                    重新书写
                  </button>
                  <button onClick={() => setStep('permissions')} className="text-[13px] tracking-[0.18em] text-zinc-300 transition-colors duration-500 hover:text-white">
                    确认归档
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'permissions' && organized && (
              <motion.div
                key="permissions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45 }}
                className="max-h-[calc(100dvh-96px)] overflow-y-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <h1 className="text-[22px] font-light leading-10 tracking-[0.08em] text-zinc-100">
                  这块碎片，要怎么留下？
                </h1>

                <div className="mt-12 flex flex-col gap-9">
                  {/* 开关一：是否公开 */}
                  <button
                    onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
                    className="flex items-start justify-between gap-4 text-left outline-none"
                  >
                    <span>
                      <span className="block text-[15px] tracking-[0.12em] text-zinc-200">允许公开这个碎片</span>
                      <span className="mt-3 block text-[12px] leading-6 tracking-[0.08em] text-zinc-500">
                        {visibility === 'public'
                          ? '进入公共陈列架，未来可能出现在首页展柜。'
                          : '默认锁入个人抽屉，仅本地保存。'}
                      </span>
                    </span>
                    <span
                      className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
                        visibility === 'public' ? 'bg-zinc-300' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#101010] transition-transform duration-300 ${
                          visibility === 'public' ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>

                  {/* 开关二：是否允许店长鉴赏 */}
                  <button
                    onClick={() => setAllowShopkeeperReview(!allowShopkeeperReview)}
                    className="flex items-start justify-between gap-4 text-left outline-none"
                  >
                    <span>
                      <span className="block text-[15px] tracking-[0.12em] text-zinc-200">允许店长鉴赏</span>
                      <span className="mt-3 block text-[12px] leading-6 tracking-[0.08em] text-zinc-500">
                        未来可能收到店长留言。不是一定收到，也不是即时收到。
                      </span>
                    </span>
                    <span
                      className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
                        allowShopkeeperReview ? 'bg-zinc-300' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#101010] transition-transform duration-300 ${
                          allowShopkeeperReview ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <div className="mt-12 flex items-center justify-between">
                  <button onClick={() => setStep('confirm')} className="text-[12px] tracking-[0.16em] text-zinc-500 transition-colors duration-500 hover:text-zinc-300">
                    返回确认
                  </button>
                  <button onClick={save} className="text-[13px] tracking-[0.18em] text-zinc-300 transition-colors duration-500 hover:text-white">
                    保存
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'saved' && (
              <motion.div
                key="saved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex min-h-[420px] flex-col items-center justify-center text-center"
              >
                <motion.div
                  id="v2-fragment-receipt"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: 0.25 }}
                  className="w-full max-w-[286px] border border-zinc-700/80 bg-zinc-950/85 px-7 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.5)]"
                >
                  <p className="font-mono text-[9px] tracking-[0.26em] text-zinc-500">DIGITAL RECEIPT</p>
                  <div className="my-6 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                  <p className="text-[15px] tracking-[0.16em] text-zinc-200">
                    [ {receiptId} 已封存。]
                  </p>
                  <p className="mt-7 text-[12px] font-light leading-7 tracking-[0.08em] text-zinc-400">
                    {organized?.narration_content || '它被安静地留在这里。'}
                  </p>
                  <div className="mt-8 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
                  <p className="mt-5 font-mono text-[9px] tracking-[0.24em] text-zinc-600">
                    {isAwakenedFromExhibit ? 'AWAKENED BY A STRANGER FRAGMENT' : 'END HERE ARCHIVE'}
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.1 }}
                  className="mt-8 flex items-center justify-center gap-8"
                >
                  <button
                    onClick={() => router.push('/v2')}
                    className="text-[12px] tracking-[0.16em] text-zinc-500 transition-colors duration-500 hover:text-zinc-300 outline-none"
                  >
                    关闭
                  </button>
                  <button
                    onClick={saveReceiptImage}
                    className="text-[12px] tracking-[0.16em] text-zinc-300 transition-colors duration-500 hover:text-white outline-none"
                  >
                    保存小票
                  </button>
                </motion.div>
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
    <Suspense fallback={<div className="min-h-dvh bg-[#101010]" />}>
      <V2NewFragmentContent />
    </Suspense>
  );
}
