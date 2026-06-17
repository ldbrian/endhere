'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  clampNarrationToOriginal,
  fallbackFragmentTitle,
  normalizeFragmentText,
  type FragmentVisibility,
} from '../../_core/fragments';
import { useFragmentStore } from '../../_core/storage';

type Step = 'input' | 'organizing' | 'confirm' | 'permissions' | 'saved';

type OrganizedFragment = {
  title: string;
  narration_content: string;
};

const INSPIRATION = ['一个情绪', '一段回忆', '一件旧物', '一句话'];

export default function V2NewFragmentPage() {
  const router = useRouter();
  const addLocalFragment = useFragmentStore((state) => state.addLocalFragment);
  const [step, setStep] = useState<Step>('input');
  const [originalContent, setOriginalContent] = useState('');
  const [organized, setOrganized] = useState<OrganizedFragment | null>(null);
  const [visibility, setVisibility] = useState<FragmentVisibility>('private');
  const [allowShopkeeperReview, setAllowShopkeeperReview] = useState(false);
  const [error, setError] = useState('');

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
        body: JSON.stringify({ original_content: original }),
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
    });

    // 🟢 CTO 修复：在这里加锁！记录最后一次成功提交的时间
    setLastSubmitTime(Date.now());

    setStep('saved');
    window.setTimeout(() => router.push('/v2'), 700);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#080808] text-zinc-200 selection:bg-zinc-800 selection:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.03),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.014)_0%,transparent_40%,rgba(255,255,255,0.008)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-7 pb-10 pt-9">
        <header className="flex shrink-0 items-center justify-between">
          <Link href="/v2" className="text-[11px] tracking-[0.18em] text-zinc-600 transition-colors duration-500 hover:text-zinc-300">
            返回
          </Link>
          <span className="text-[10px] tracking-[0.24em] text-zinc-700">NEW FRAGMENT</span>
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
                <p className="text-[13px] leading-8 tracking-[0.1em] text-zinc-500">你可以留下：</p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-[13px] tracking-[0.1em] text-zinc-400">
                  {INSPIRATION.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <p className="mt-8 text-[13px] tracking-[0.08em] text-zinc-600">所有体验都值得被记录。</p>

                {/* 🟢 CDO 修复：移除所有 border，增加聚焦时的微弱文字发光效应，强调空间感 */}
                <textarea
                  value={originalContent}
                  onChange={(event) => setOriginalContent(event.target.value)}
                  placeholder="今天有什么东西，值得被留下来？"
                  className="mt-12 h-32 w-full resize-none border-none bg-transparent pb-4 text-[15px] font-light leading-8 tracking-[0.08em] text-zinc-200 outline-none placeholder:text-zinc-800 focus:ring-0 focus:drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                  maxLength={800} // 依照宪法 PRD，放宽至 800 字
                  autoFocus
                />

                <div className="mt-7 flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.14em] text-zinc-700">{original.length}/140</span>
                  <button
                    onClick={organize}
                    disabled={!original}
                    className="text-[13px] tracking-[0.18em] text-zinc-300 transition-colors duration-500 hover:text-white disabled:text-zinc-800"
                  >
                    交给档案员
                  </button>
                </div>
                {error && <p className="mt-6 text-[11px] tracking-[0.12em] text-red-900/80">{error}</p>}
              </motion.div>
            )}

            {step === 'organizing' && (
              <motion.div key="organizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                <div className="mx-auto mb-8 h-2 w-2 rounded-full bg-zinc-600 animate-pulse" />
                <p className="text-[14px] tracking-[0.16em] text-zinc-500">档案员正在整理这块碎片</p>
                <p className="mt-6 text-[11px] tracking-[0.12em] text-zinc-700">不会改写你的原文。</p>
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
                <span className="text-[10px] tracking-[0.24em] text-zinc-700">归档确认</span>
                <h1 className="mt-6 text-[24px] font-light leading-10 tracking-[0.08em] text-zinc-100">
                  {organized.title}
                </h1>

                <div className="mt-10 border-l border-zinc-800 pl-5">
                  <p className="text-[11px] tracking-[0.2em] text-zinc-700">用户原文</p>
                  <p className="mt-5 whitespace-pre-wrap text-[15px] font-light leading-8 tracking-[0.06em] text-zinc-300">
                    {original}
                  </p>
                </div>

                <div className="mt-10 border-l border-zinc-900 pl-5">
                  <p className="text-[11px] tracking-[0.2em] text-zinc-700">档案旁白</p>
                  <p className="mt-5 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.06em] text-zinc-500">
                    {organized.narration_content || '这块碎片暂时不需要旁白。'}
                  </p>
                </div>

                <div className="mt-12 flex items-center justify-between">
                  <button onClick={() => setStep('input')} className="text-[12px] tracking-[0.16em] text-zinc-700 transition-colors duration-500 hover:text-zinc-400">
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
                      <span className="mt-3 block text-[12px] leading-6 tracking-[0.08em] text-zinc-600">
                        {visibility === 'public'
                          ? '进入公共陈列架，未来可能出现在首页展柜。'
                          : '默认锁入个人抽屉，仅本地保存。'}
                      </span>
                    </span>
                    <span
                      className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
                        visibility === 'public' ? 'bg-zinc-400' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#080808] transition-transform duration-300 ${
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
                      <span className="mt-3 block text-[12px] leading-6 tracking-[0.08em] text-zinc-600">
                        未来可能收到店长留言。不是一定收到，也不是即时收到。
                      </span>
                    </span>
                    <span
                      className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
                        allowShopkeeperReview ? 'bg-zinc-400' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#080808] transition-transform duration-300 ${
                          allowShopkeeperReview ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <div className="mt-12 flex items-center justify-between">
                  <button onClick={() => setStep('confirm')} className="text-[12px] tracking-[0.16em] text-zinc-700 transition-colors duration-500 hover:text-zinc-400">
                    返回确认
                  </button>
                  <button onClick={save} className="text-[13px] tracking-[0.18em] text-zinc-300 transition-colors duration-500 hover:text-white">
                    保存
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'saved' && (
              <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <p className="text-[15px] tracking-[0.18em] text-zinc-300">已归档</p>
                <p className="mt-6 text-[11px] tracking-[0.12em] text-zinc-700">正在回到大厅。</p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}