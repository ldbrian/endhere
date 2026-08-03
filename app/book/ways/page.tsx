'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LENSES, type LensId, type LandedSignal, type Observation } from '../../lib/ways/lens';
import { useWaysArchive } from '../_core/waysArchive';
import { track } from '../_core/analytics';

// V6 观察方式（Ways of Seeing）—— 前端交互
// 写下困扰 → 三个观察入口（用户自己选）→ 镜子问一句 → 回应 + landed → 留进档案。
// 全程不出现"分析/画像/心理学"；文案是"换个角度看"，不是"AI 帮你分析"。

type Phase = 'write' | 'entrances' | 'angle' | 'done';

type Entrance = {
  lens_id: LensId;
  label: string;
  entrance: string;
};

type AngleResult = {
  lens_id: LensId;
  question: string;
  angle_note: string;
};

const LANDED_OPTIONS: { value: LandedSignal; label: string }[] = [
  { value: 'new', label: '看见新的东西' },
  { value: 'seen', label: '早就知道' },
  { value: 'unsure', label: '说不清' },
];

function landedLabel(value: LandedSignal) {
  return LANDED_OPTIONS.find((item) => item.value === value)?.label ?? '';
}

export default function WaysPage() {
  const router = useRouter();
  const observations = useWaysArchive((state) => state.observations);
  const addObservation = useWaysArchive((state) => state.addObservation);

  const [phase, setPhase] = useState<Phase>('write');
  const [fragment, setFragment] = useState('');
  const [entrances, setEntrances] = useState<Entrance[]>([]);
  const [entrancesLoading, setEntrancesLoading] = useState(false);
  const [selectedLens, setSelectedLens] = useState<LensId | null>(null);
  const [angle, setAngle] = useState<AngleResult | null>(null);
  const [angleLoading, setAngleLoading] = useState(false);
  const [userResponse, setUserResponse] = useState('');
  const [landed, setLanded] = useState<LandedSignal>(null);
  const [error, setError] = useState('');

  const submitFragment = async () => {
    const trimmed = fragment.trim();
    if (!trimmed) {
      setError('先写下一件事，镜子才看得见。');
      return;
    }
    setError('');
    setEntrancesLoading(true);
    setPhase('entrances');
    track('v6_ways_submit', { char_count: trimmed.length });
    try {
      const res = await fetch('/api/book/ways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_content: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setError('今天已经看得够多了，明天再来。');
        } else {
          setError('镜子今天有些疲倦，稍后再试。');
        }
        setPhase('write');
        return;
      }
      setEntrances(Array.isArray(data.entrances) ? data.entrances : []);
    } catch {
      setError('镜子没有回应，请稍后再试。');
      setPhase('write');
    } finally {
      setEntrancesLoading(false);
    }
  };

  const pickLens = async (lensId: LensId) => {
    setSelectedLens(lensId);
    setAngle(null);
    setUserResponse('');
    setLanded(null);
    setError('');
    setAngleLoading(true);
    setPhase('angle');
    track('v6_ways_lens_picked', { lens: lensId });
    try {
      const res = await fetch('/api/book/ways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_content: fragment.trim(), lens_id: lensId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 429 ? '今天已经看得够多了，明天再来。' : '这一枚角度没能成型，换一个试试。');
        return;
      }
      setAngle({ lens_id: lensId, question: data.question, angle_note: data.angle_note });
    } catch {
      setError('镜子没有回应，请稍后再试。');
    } finally {
      setAngleLoading(false);
    }
  };

  const saveObservation = () => {
    if (!selectedLens || !angle) return;
    const observation: Observation = {
      id: `way_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      fragment: fragment.trim(),
      lensId: selectedLens,
      angle: angle.question,
      angleNote: angle.angle_note,
      userResponse: userResponse.trim() || undefined,
      landed: landed ?? undefined,
    };
    addObservation(observation);
    track('v6_observation_kept', {
      lens: selectedLens,
      landed: landed ?? 'none',
      has_response: Boolean(observation.userResponse),
      total: observations.length + 1,
    });
    setPhase('done');
  };

  const lookAgain = () => {
    setAngle(null);
    setUserResponse('');
    setLanded(null);
    setSelectedLens(null);
    setError('');
    setPhase('entrances');
  };

  const rewrite = () => {
    setAngle(null);
    setUserResponse('');
    setLanded(null);
    setSelectedLens(null);
    setEntrances([]);
    setError('');
    setFragment('');
    setPhase('write');
  };

  const isFirstObservation = observations.length === 1;
  const selected = selectedLens ? LENSES[selectedLens] : null;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#1B1614] text-stone-100 selection:bg-stone-700 selection:text-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.035),transparent_34%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-7 pb-9 pt-7">
        <header className="flex shrink-0 items-center justify-between">
          <Link
            href="/book"
            onClick={() => track('v6_ways_close')}
            className="border-b border-transparent pb-1 text-[11px] tracking-[0.16em] text-stone-500 transition-colors duration-500 hover:border-stone-700 hover:text-stone-300"
          >
            合上
          </Link>
          <span className="font-mono text-[10px] tracking-[0.24em] text-stone-600">WAYS OF SEEING</span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-8">
          <AnimatePresence mode="wait">
            {phase === 'write' && (
              <motion.div key="write" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.42 }}>
                <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600">写下让你困住的那件事</p>
                <textarea
                  value={fragment}
                  onChange={(event) => setFragment(event.target.value)}
                  placeholder="一句话，也是一件困住你的事。"
                  className="mt-8 min-h-[200px] w-full resize-none border-y border-stone-800/70 bg-transparent py-8 text-[19px] font-light leading-10 tracking-[0.04em] text-stone-100 outline-none placeholder:text-stone-700 focus:ring-0"
                  maxLength={700}
                  autoFocus
                />
                <div className="mt-7 flex items-center justify-between gap-6">
                  <span className="font-mono text-[10px] tracking-[0.14em] text-stone-600">{fragment.trim().length}/700</span>
                  <button
                    type="button"
                    onClick={submitFragment}
                    disabled={!fragment.trim()}
                    className="text-[13px] tracking-[0.18em] text-stone-200 transition-colors duration-500 hover:text-white disabled:text-stone-600"
                  >
                    换个角度看
                  </button>
                </div>
                {error && <p className="mt-6 text-[12px] tracking-[0.1em] text-stone-500">{error}</p>}
              </motion.div>
            )}

            {phase === 'entrances' && (
              <motion.div key="entrances" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.42 }}>
                <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600">三个角度，选一个来看</p>
                <p className="mt-5 border-l border-stone-800/80 pl-4 text-[13px] font-light leading-7 tracking-[0.06em] text-stone-500">
                  {fragment.trim()}
                </p>

                {entrancesLoading ? (
                  <div className="mt-10 text-center">
                    <div className="mx-auto mb-8 h-2 w-2 rounded-full bg-stone-500 animate-pulse" />
                    <p className="text-[14px] tracking-[0.16em] text-stone-400">镜子正在看…</p>
                  </div>
                ) : (
                  <div className="mt-8 space-y-3">
                    {entrances.map((entry, index) => {
                      const lens = LENSES[entry.lens_id];
                      return (
                        <motion.button
                          key={entry.lens_id}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.34, delay: index * 0.06 }}
                          onClick={() => pickLens(entry.lens_id)}
                          className="group w-full border border-stone-800/70 px-5 py-5 text-left transition-colors duration-500 hover:border-[#8b6b45]/50 hover:bg-stone-800/10 cursor-pointer"
                        >
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="text-[17px] font-light tracking-[0.08em] text-stone-200 transition-colors duration-500 group-hover:text-[#ecd9b0]">
                              {lens?.poetic ?? entry.label}
                            </span>
                            <span className="font-mono text-[10px] tracking-[0.2em] text-stone-600">{String(index + 1).padStart(2, '0')}</span>
                          </div>
                          <p className="mt-2 text-[12px] font-light leading-6 tracking-[0.05em] text-stone-500">{entry.entrance}</p>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {error && <p className="mt-6 text-[12px] tracking-[0.1em] text-stone-500">{error}</p>}
                <button
                  type="button"
                  onClick={rewrite}
                  className="mt-8 text-[11px] tracking-[0.16em] text-stone-600 transition-colors duration-500 hover:text-stone-400"
                >
                  ← 重新写
                </button>
              </motion.div>
            )}

            {phase === 'angle' && (
              <motion.div key="angle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.42 }}>
                <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600">
                  {selected ? `${selected.label} · ${selected.poetic}` : '观察方式'}
                </p>

                {angleLoading ? (
                  <div className="mt-10 text-center">
                    <div className="mx-auto mb-8 h-2 w-2 rounded-full bg-stone-500 animate-pulse" />
                    <p className="text-[14px] tracking-[0.16em] text-stone-400">镜子正在看…</p>
                  </div>
                ) : error ? (
                  <div className="mt-10 text-center">
                    <p className="text-[13px] tracking-[0.08em] text-stone-500">{error}</p>
                    <button
                      type="button"
                      onClick={lookAgain}
                      className="mt-8 text-[11px] tracking-[0.16em] text-stone-600 transition-colors duration-500 hover:text-stone-400"
                    >
                      换个角度
                    </button>
                  </div>
                ) : angle ? (
                  <>
                    <div className="mt-8 border-y border-stone-800/70 py-10">
                      <p className="text-center font-mono text-[9px] tracking-[0.3em] text-stone-600/80">这面镜子问</p>
                      <p className="mt-6 whitespace-pre-wrap text-center text-[19px] font-light leading-10 tracking-[0.04em] text-stone-100">
                        {angle.question}
                      </p>
                    </div>

                    <textarea
                      value={userResponse}
                      onChange={(event) => setUserResponse(event.target.value)}
                      placeholder="此刻，你想到了什么？（可留白）"
                      className="mt-8 min-h-[90px] w-full resize-none border-b border-stone-800/70 bg-transparent py-5 text-[14px] font-light leading-7 tracking-[0.04em] text-stone-300 outline-none placeholder:text-stone-700 focus:ring-0"
                      maxLength={400}
                    />

                    <p className="mt-8 text-[11px] font-light leading-6 tracking-[0.06em] text-stone-500">
                      这个角度，是让你看见了新的东西，还是你早就知道？
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {LANDED_OPTIONS.map((option) => {
                        const isActive = landed === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setLanded(option.value);
                              track('v6_ways_landed', { lens: selectedLens, value: option.value });
                            }}
                            className={`border px-4 py-2 text-[12px] tracking-[0.1em] transition-colors duration-300 cursor-pointer ${
                              isActive
                                ? 'border-[#c9a86c]/60 text-[#ecd9b0]'
                                : 'border-stone-800/70 text-stone-500 hover:border-stone-700 hover:text-stone-300'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-10 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={lookAgain}
                        className="text-[11px] tracking-[0.16em] text-stone-600 transition-colors duration-500 hover:text-stone-400"
                      >
                        换个角度
                      </button>
                      <button
                        type="button"
                        onClick={saveObservation}
                        disabled={!landed}
                        className="text-[13px] tracking-[0.18em] transition-colors duration-500 cursor-pointer disabled:cursor-not-allowed disabled:text-stone-600 text-stone-200 hover:text-white"
                      >
                        留在这个角度里
                      </button>
                    </div>
                  </>
                ) : null}
              </motion.div>
            )}

            {phase === 'done' && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <p className="font-mono text-[10px] tracking-[0.26em] text-stone-600">OBSERVATION KEPT</p>
                <p className="mt-8 text-[20px] font-light leading-10 tracking-[0.05em] text-stone-100">这个角度，替你留住了。</p>
                {isFirstObservation ? (
                  <p className="mt-4 text-[13px] font-light tracking-[0.1em] text-stone-500">这是你留下的第一个观察。</p>
                ) : (
                  <p className="mt-4 text-[13px] font-light tracking-[0.1em] text-stone-500">它已经被收进档案里。</p>
                )}

                {selected && angle ? (
                  <div className="mt-10 w-full max-w-[340px] border-y border-stone-800/70 py-6 text-left">
                    <p className="text-[11px] tracking-[0.14em] text-stone-500">
                      {selected.label} · {selected.poetic}
                    </p>
                    <p className="mt-3 text-[14px] font-light leading-7 tracking-[0.04em] text-stone-200">{angle.question}</p>
                    {userResponse.trim() ? (
                      <p className="mt-4 border-l border-stone-800 pl-3 text-[12px] font-light leading-6 tracking-[0.05em] text-stone-500">
                        你：{userResponse.trim()}
                      </p>
                    ) : null}
                    {landed ? (
                      <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-stone-600">{landedLabel(landed)}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-12 flex items-center justify-center gap-8">
                  <button
                    type="button"
                    onClick={lookAgain}
                    className="text-[11px] tracking-[0.16em] text-stone-600 transition-colors duration-500 hover:text-stone-400"
                  >
                    再换一个角度
                  </button>
                  <Link
                    href="/book/mirror"
                    onClick={() => track('v6_observation_to_mirror')}
                    className="border-b border-dashed border-stone-700/60 pb-0.5 text-[11px] tracking-[0.16em] text-stone-500 transition-colors duration-500 hover:border-stone-400 hover:text-stone-300"
                  >
                    去看镜中书
                  </Link>
                  <button
                    type="button"
                    onClick={() => router.push('/book')}
                    className="text-[12px] tracking-[0.16em] text-stone-500 transition-colors duration-500 hover:text-stone-300"
                  >
                    回到书里
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
