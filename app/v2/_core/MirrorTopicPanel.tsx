'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { track } from './analytics';
import type { Fragment } from './fragments';
import { useFragmentStore } from './storage';

type TimeFrame = 7 | 30 | 90 | 'all';
type TopicKey = 'ride_hailing' | 'product' | 'code' | 'family' | 'money' | 'body' | 'child' | 'self';
type Sentiment = 'annoyed' | 'excited' | 'tired' | 'calm' | 'angry' | 'blank' | 'hurried';

type TopicHit = {
  topic: TopicKey;
  sentiment: Sentiment;
};

type MirrorFragment = {
  id: string;
  createdAt: string;
  text: string;
  hits: TopicHit[];
  rawKeywords: string[];
};

type TopicSummary = {
  topic: TopicKey;
  label: string;
  currentCount: number;
  previousCount: number;
  deltaPercent: number;
  deltaCount: number;
  dominantSentiment: Sentiment;
  dominantSentimentLabel: string;
  latestFragment: MirrorFragment | null;
  fragments: MirrorFragment[];
};

type Finding = {
  label: string;
  count: number;
};

const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: 7, label: '7 \u5929' },
  { value: 30, label: '30 \u5929' },
  { value: 90, label: '90 \u5929' },
  { value: 'all', label: '\u5168\u90e8' },
];

const TOPICS: { key: TopicKey; label: string; keywords: string[] }[] = [
  { key: 'ride_hailing', label: '\u7f51\u7ea6\u8f66', keywords: ['\u6d3e\u5355\u7cfb\u7edf', '\u50bb\u903c\u53f8\u673a', '\u5835\u8f66', '\u5171\u4eab\u5355\u8f66'] },
  { key: 'product', label: '\u4ea7\u54c1', keywords: ['\u4fe1\u606f\u6d41', '\u955c\u5b50', '\u7ed3\u6784', '\u9875\u9762'] },
  { key: 'code', label: '\u4ee3\u7801', keywords: ['\u6784\u5efa', '\u7c7b\u578b\u9519\u8bef', '\u63a5\u53e3', '\u8def\u7531'] },
  { key: 'family', label: '\u5bb6\u5ead', keywords: ['\u7535\u8bdd', '\u665a\u996d', '\u5bb6\u91cc'] },
  { key: 'money', label: '\u8d5a\u94b1', keywords: ['\u8d26\u5355', '\u623f\u79df', '\u4f59\u989d', '\u751f\u610f'] },
  { key: 'body', label: '\u8eab\u4f53', keywords: ['\u8170\u75db', '\u80a9\u8180', '\u5934\u75bc'] },
  { key: 'child', label: '\u5b69\u5b50', keywords: ['\u4f5c\u4e1a', '\u4e66\u5305', '\u6821\u95e8'] },
  { key: 'self', label: '\u81ea\u5df1', keywords: ['\u6211\u81ea\u5df1', '\u623f\u95f4', '\u6c89\u9ed8'] },
];

const SENTIMENT_LABELS: Record<Sentiment, string> = {
  annoyed: '\u70e6\u8e81',
  excited: '\u5174\u594b',
  tired: '\u75b2\u60eb',
  calm: '\u5e73\u9759',
  angry: '\u6124\u6012',
  blank: '\u7a7a',
  hurried: '\u8d76',
};

const POSITIVE_SENTIMENTS = new Set<Sentiment>(['excited', 'calm']);
const FINDING_TOPICS: TopicKey[] = ['money', 'child', 'self'];
const FINDING_WORDS = ['\u7d2f', '\u70e6', '\u8d76', '\u6ca1\u65f6\u95f4'];

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

function buildMockFragments(): MirrorFragment[] {
  const today = new Date('2026-06-24T12:00:00+08:00');
  const topicCycle: TopicKey[] = ['ride_hailing', 'product', 'code', 'family', 'money', 'body', 'child'];
  const recentPrimary: TopicKey[] = [
    'ride_hailing',
    'product',
    'ride_hailing',
    'product',
    'body',
    'money',
    'ride_hailing',
    'code',
    'child',
    'product',
  ];
  const recentSentiments: Sentiment[] = ['annoyed', 'excited', 'angry', 'excited', 'tired', 'hurried', 'annoyed', 'tired', 'calm', 'excited'];
  const olderSentiments: Sentiment[] = ['calm', 'blank', 'tired', 'annoyed', 'hurried'];

  return Array.from({ length: 90 }, (_, dayIndex) => {
    const date = new Date(today);
    date.setDate(today.getDate() - dayIndex);
    const isRecent = dayIndex < 30;
    const primaryTopic = isRecent ? pick(recentPrimary, dayIndex) : pick(topicCycle, dayIndex);
    const secondaryTopic = isRecent ? pick(['money', 'child', 'code', 'family', 'body', 'ride_hailing', 'self'] as TopicKey[], dayIndex + 2) : pick(topicCycle, dayIndex + 3);
    const sentiment = isRecent ? pick(recentSentiments, dayIndex) : pick(olderSentiments, dayIndex);
    const secondarySentiment = primaryTopic === 'product' ? 'excited' : pick(olderSentiments, dayIndex + 2);
    const primary = TOPICS.find((topic) => topic.key === primaryTopic) || TOPICS[0];
    const secondary = TOPICS.find((topic) => topic.key === secondaryTopic) || TOPICS[1];
    const keyword = pick(primary.keywords, dayIndex);
    const secondaryKeyword = pick(secondary.keywords, dayIndex + 1);

    return {
      id: `mock-observation-${dayIndex}`,
      createdAt: date.toISOString(),
      text: `${date.toLocaleDateString('zh-CN')}\uff0c${primary.label}\u91cc\u7684${keyword}\u88ab\u8bb0\u4e86\u4e0b\u6765\u3002${SENTIMENT_LABELS[sentiment]}\u3002\u540e\u9762\u53c8\u63d0\u5230${secondary.label}\u548c${secondaryKeyword}\u3002`,
      hits: [
        { topic: primaryTopic, sentiment },
        { topic: secondaryTopic, sentiment: secondarySentiment },
      ],
      rawKeywords: [keyword, secondaryKeyword, pick(FINDING_WORDS, dayIndex)],
    };
  });
}

const MOCK_FRAGMENTS = buildMockFragments();

const SENTIMENT_KEYWORDS: Record<Sentiment, string[]> = {
  annoyed: ['\u70e6', '\u70e6\u8e81', '\u9ebb\u70e6', '\u7cdf\u5fc3', '\u53d7\u591f', '\u538c', '\u6076\u5fc3'],
  excited: ['\u5f00\u5fc3', '\u5174\u594b', '\u671f\u5f85', '\u559c\u6b22', '\u987a\u5229', '\u6ee1\u8db3'],
  tired: ['\u7d2f', '\u75b2\u60eb', '\u56f0', '\u6491\u4e0d\u4f4f', '\u6ca1\u529b\u6c14', '\u8017\u5c3d', '\u8170\u75db'],
  calm: ['\u5e73\u9759', '\u5b89\u9759', '\u8212\u670d', '\u8f7b\u677e', '\u6162\u4e0b\u6765'],
  angry: ['\u751f\u6c14', '\u6124\u6012', '\u706b\u5927', '\u8001\u767b', '\u963b\u788d', '\u50bb\u903c', '\u8ba8\u538c'],
  blank: ['\u7a7a', '\u9ebb\u6728', '\u6ca1\u611f\u89c9', '\u4e0d\u77e5\u9053', '\u8bf4\u4e0d\u4e0a\u6765'],
  hurried: ['\u8d76', '\u6765\u4e0d\u53ca', '\u6ca1\u65f6\u95f4', '\u5306\u5fd9', '\u50ac', '\u6025'],
};

function textIncludes(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function detectSentiment(text: string): Sentiment {
  const rows = (Object.entries(SENTIMENT_KEYWORDS) as [Sentiment, string[]][])
    .map(([sentiment, words]) => ({
      sentiment,
      count: words.filter((word) => textIncludes(text, word)).length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  return rows[0]?.sentiment || 'blank';
}

function buildLocalMirrorFragments(fragments: Fragment[]): MirrorFragment[] {
  return fragments
    .map((fragment) => {
      const combinedText = fragment.title + '\n' + fragment.original_content + '\n' + (fragment.narration_content || '');
      const sentiment = detectSentiment(combinedText);
      const matchedTopics = TOPICS.filter((topic) =>
        [topic.label, ...topic.keywords].some((keyword) => textIncludes(combinedText, keyword))
      ).slice(0, 3);
      const fallbackTopic = TOPICS.find((topic) => topic.key === 'self') || TOPICS[0];
      const topics = matchedTopics.length > 0 ? matchedTopics : [fallbackTopic];
      const rawKeywords = [
        ...TOPICS.flatMap((topic) => [topic.label, ...topic.keywords]).filter((keyword) => textIncludes(combinedText, keyword)),
        ...FINDING_WORDS.filter((word) => textIncludes(combinedText, word)),
        ...Object.values(SENTIMENT_KEYWORDS).flat().filter((word) => textIncludes(combinedText, word)),
      ];

      return {
        id: fragment.id,
        createdAt: fragment.created_at || fragment.updated_at || new Date(0).toISOString(),
        text: fragment.original_content,
        hits: topics.map((topic) => ({ topic: topic.key, sentiment })),
        rawKeywords: Array.from(new Set(rawKeywords)),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function filterByFrame(fragments: MirrorFragment[], frame: TimeFrame, offsetWindows = 0) {
  if (frame === 'all') return offsetWindows === 0 ? fragments : [];
  const days = frame;
  const end = Date.now() - offsetWindows * days * 24 * 60 * 60 * 1000;
  const start = end - days * 24 * 60 * 60 * 1000;
  return fragments.filter((fragment) => {
    const time = new Date(fragment.createdAt).getTime();
    return Number.isFinite(time) && time <= end && time > start;
  });
}
function percentDelta(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function summarizeTopics(currentFragments: MirrorFragment[], previousFragments: MirrorFragment[]): TopicSummary[] {
  return TOPICS.map((topic) => {
    const fragments = currentFragments.filter((fragment) => fragment.hits.some((hit) => hit.topic === topic.key));
    const previousCount = previousFragments.filter((fragment) => fragment.hits.some((hit) => hit.topic === topic.key)).length;
    const sentimentCounts = new Map<Sentiment, number>();

    fragments.forEach((fragment) => {
      fragment.hits
        .filter((hit) => hit.topic === topic.key)
        .forEach((hit) => sentimentCounts.set(hit.sentiment, (sentimentCounts.get(hit.sentiment) || 0) + 1));
    });

    const dominantSentiment = Array.from(sentimentCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'blank';
    const latestFragment = [...fragments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;

    return {
      topic: topic.key,
      label: topic.label,
      currentCount: fragments.length,
      previousCount,
      deltaPercent: percentDelta(fragments.length, previousCount),
      deltaCount: fragments.length - previousCount,
      dominantSentiment,
      dominantSentimentLabel: SENTIMENT_LABELS[dominantSentiment],
      latestFragment,
      fragments,
    };
  })
    .filter((summary) => summary.currentCount > 0)
    .sort((a, b) => b.currentCount - a.currentCount);
}

function getTopicCounts(fragments: MirrorFragment[]) {
  return TOPICS.map((topic) => ({
    topic: topic.key,
    label: topic.label,
    count: fragments.filter((fragment) => fragment.hits.some((hit) => hit.topic === topic.key)).length,
  })).sort((a, b) => b.count - a.count);
}

function getSustainedPositiveTopic(currentFragments: MirrorFragment[], previousFragments: MirrorFragment[]) {
  const rows = TOPICS.map((topic) => {
    const currentPositive = currentFragments.filter((fragment) =>
      fragment.hits.some((hit) => hit.topic === topic.key && POSITIVE_SENTIMENTS.has(hit.sentiment))
    ).length;
    const previousPositive = previousFragments.filter((fragment) =>
      fragment.hits.some((hit) => hit.topic === topic.key && POSITIVE_SENTIMENTS.has(hit.sentiment))
    ).length;
    return { label: topic.label, currentPositive, previousPositive };
  })
    .filter((row) => row.currentPositive > 0 && row.previousPositive > 0)
    .sort((a, b) => b.currentPositive + b.previousPositive - (a.currentPositive + a.previousPositive));

  return rows[0] || null;
}

function getFindings(fragments: MirrorFragment[]) {
  const topicFindings: Finding[] = FINDING_TOPICS.map((topicKey) => {
    const topic = TOPICS.find((item) => item.key === topicKey) || TOPICS[0];
    return {
      label: topic.label,
      count: fragments.filter((fragment) => fragment.hits.some((hit) => hit.topic === topicKey)).length,
    };
  });

  const wordFindings: Finding[] = FINDING_WORDS.map((word) => ({
    label: word,
    count: fragments.filter((fragment) => fragment.rawKeywords.includes(word)).length,
  })).sort((a, b) => b.count - a.count);

  return { topicFindings, wordFindings };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function formatTrend(value: number) {
  if (value === 0) return '0%';
  return `${value > 0 ? '\u2191 ' : '\u2193 '}${Math.abs(value)}%`;
}

export function MirrorTopicPanel({ embedded = false }: { embedded?: boolean }) {
  const [frame, setFrame] = useState<TimeFrame>(30);
  const [activeTopic, setActiveTopic] = useState<TopicKey | null>(null);
  const localFragments = useFragmentStore((state) => state.localFragments);
  const hasHydrated = useFragmentStore((state) => state._hasHydrated);
  const mirrorFragments = useMemo(() => buildLocalMirrorFragments(localFragments), [localFragments]);
  const currentFragments = useMemo(() => filterByFrame(mirrorFragments, frame, 0), [mirrorFragments, frame]);
  const previousFragments = useMemo(() => filterByFrame(mirrorFragments, frame, 1), [mirrorFragments, frame]);
  const summaries = useMemo(() => summarizeTopics(currentFragments, previousFragments), [currentFragments, previousFragments]);
  const topicCounts = useMemo(() => getTopicCounts(currentFragments), [currentFragments]);
  const positiveTopic = useMemo(() => getSustainedPositiveTopic(currentFragments, previousFragments), [currentFragments, previousFragments]);
  const findings = useMemo(() => getFindings(currentFragments), [currentFragments]);
  const activeSummary = summaries.find((summary) => summary.topic === activeTopic) || null;
  const frameLabel = TIME_FRAMES.find((item) => item.value === frame)?.label || '30 \u5929';
  const topThreeTopics = topicCounts.filter((row) => row.count > 0).slice(0, 3);
  const leastTopic = [...topicCounts].reverse().find((row) => row.count > 0) || null;

  if (!hasHydrated) {
    return (
      <div className={embedded ? 'flex h-full items-center justify-center' : 'min-h-dvh bg-[#101010] px-7 py-12 text-zinc-100'}>
        <p className="text-[11px] tracking-[0.18em] text-zinc-600">正在读取本地碎片</p>
      </div>
    );
  }

  if (mirrorFragments.length === 0) {
    return (
      <div className={embedded ? 'flex h-full flex-col justify-center' : 'min-h-dvh bg-[#101010] px-7 py-12 text-zinc-100'}>
        <p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR SUMMARY</p>
        <p className="mt-5 text-[15px] leading-8 tracking-[0.1em] text-zinc-300">这里还没有你的本地碎片。</p>
        <p className="mt-4 text-[12px] leading-7 tracking-[0.08em] text-zinc-500">留下第一块碎片后，镜子会从这个浏览器的 localStorage 里读取它。</p>
      </div>
    );
  }

  return (
    <div className={embedded ? 'h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}>
      <div className="flex items-center gap-5 border-b border-zinc-900/80 pb-3">
        {TIME_FRAMES.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => {
              setFrame(option.value);
              setActiveTopic(null);
              track('v3_mirror_timeframe_tap', { frame: option.value });
            }}
            className={`border-b pb-1 text-[11px] tracking-[0.12em] transition-colors duration-500 ${
              frame === option.value ? 'border-zinc-200 text-zinc-100' : 'border-transparent text-zinc-600 hover:text-zinc-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="mt-6 border-b border-zinc-900/80 pb-6">
        <p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR SUMMARY</p>
        <p className="mt-4 text-[13px] tracking-[0.12em] text-zinc-400">{`\u8fc7\u53bb${frameLabel}`}</p>
        <div className="mt-5 grid gap-4 text-[13px] font-light leading-7 tracking-[0.06em] text-zinc-300">
          <ObservationLine label={'\u5171\u7559\u4e0b'} value={`${currentFragments.length} ${'\u6761\u788e\u7247'}`} />
          <ObservationLine label={'\u6700\u5e38\u51fa\u73b0\u7684\u8bdd\u9898'} value={topThreeTopics.map((topic) => topic.label).join(' / ')} />
          <ObservationLine
            label={'\u6301\u7eed\u5e26\u6765\u79ef\u6781\u60c5\u7eea\u7684\u8bdd\u9898'}
            value={positiveTopic ? `${positiveTopic.label}\uff08${positiveTopic.currentPositive} \u6b21\uff09` : '\u6682\u65e0'}
          />
          <ObservationLine label={'\u6700\u5c11\u88ab\u5173\u6ce8\u7684\u8bdd\u9898'} value={leastTopic ? `${leastTopic.label}${'\uff08'}${leastTopic.count} ${'\u6b21'}${'\uff09'}` : '\u6682\u65e0'} />
        </div>
      </section>

      <section className="mt-6 border-b border-zinc-900/80 pb-6">
        <p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">TREND CHANGES</p>
        <p className="mt-3 text-[12px] tracking-[0.1em] text-zinc-600">{'\u4e0e\u4e0a\u4e00\u5468\u671f\u76f8\u6bd4'}</p>
        <div className="mt-5 grid gap-3">
          {summaries.slice(0, 5).map((summary) => (
            <div key={summary.topic} className="flex items-center justify-between gap-5 text-[15px] tracking-[0.08em]">
              <span className="text-zinc-200">{summary.label}</span>
              <span className="font-mono text-[13px] text-slate-400/80">{formatTrend(summary.deltaPercent)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        <p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">TOPIC METRICS</p>
        {summaries.map((summary, index) => {
          const active = activeTopic === summary.topic;
          return (
            <motion.button
              key={summary.topic}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: index * 0.035 }}
              onClick={() => {
                setActiveTopic(active ? null : summary.topic);
                track('v3_mirror_topic_tap', { topic: summary.label, frame });
              }}
              className={`bg-zinc-950/34 px-5 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.022)] transition-colors ${
                active ? 'outline outline-1 outline-zinc-600/70' : 'hover:bg-zinc-950/50'
              }`}
            >
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <h2 className="text-[23px] font-semibold leading-8 tracking-[0.08em] text-zinc-50">{summary.label}</h2>
                  <p className="mt-3 text-[11px] tracking-[0.12em] text-zinc-600">
                    {summary.currentCount} {'\u6761\u788e\u7247'}
                    <span className="ml-3 font-mono text-slate-400/70">{formatTrend(summary.deltaPercent)}</span>
                  </p>
                </div>
                <div className="shrink-0 border border-slate-500/25 px-3 py-2 text-right">
                  <p className="font-mono text-[8px] tracking-[0.18em] text-zinc-600">DOMINANT</p>
                  <p className="mt-1 text-[12px] tracking-[0.12em] text-slate-300/90">{summary.dominantSentimentLabel}</p>
                </div>
              </div>
              {summary.latestFragment && (
                <div className="mt-5 border-l border-zinc-800 pl-4">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-zinc-700">{'\u6700\u8fd1\u4e00\u6b21'} / {formatDate(summary.latestFragment.createdAt)}</p>
                  <p className="mt-2 line-clamp-2 text-[12px] font-light leading-6 tracking-[0.05em] text-zinc-400">
                    {summary.latestFragment.text}
                  </p>
                </div>
              )}
            </motion.button>
          );
        })}
      </section>

      <section className="mt-7 border-t border-zinc-900/80 pb-5 pt-6">
        <p className="font-mono text-[10px] tracking-[0.24em] text-zinc-600">MIRROR FINDINGS</p>
        <div className="mt-5 grid gap-3 text-[13px] font-light leading-7 tracking-[0.06em] text-zinc-300">
          {findings.topicFindings.map((finding) => (
            <ObservationLine key={finding.label} label={`${'\u63d0\u5230'}${finding.label}`} value={`${finding.count} ${'\u6b21'}`} />
          ))}
        </div>
        <p className="mt-6 font-mono text-[10px] tracking-[0.2em] text-zinc-600">MOST SEEN WORDS</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-4">
          {findings.wordFindings.map((word, index) => (
            <span key={word.label} className={`text-[15px] font-light tracking-[0.08em] ${index === 0 ? 'text-zinc-200' : index === 1 ? 'text-zinc-300' : 'text-zinc-500'}`}>
              {word.label}
            </span>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {activeSummary && (
          <motion.section
            key={activeSummary.topic}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="overflow-hidden border-t border-zinc-800/80 pb-8 pt-5"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">
                EVIDENCE / {activeSummary.label} / {activeSummary.fragments.length}
              </p>
              <button
                type="button"
                onClick={() => setActiveTopic(null)}
                className="text-[11px] tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200"
              >
                {'\u6536\u8d77'}
              </button>
            </div>
            <div className="grid gap-4">
              {activeSummary.fragments.map((fragment) => (
                <article key={fragment.id} className="border-l border-zinc-700 pl-4">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-zinc-600">{formatDate(fragment.createdAt)}</p>
                  <p className="mt-3 whitespace-pre-wrap text-[13px] font-light leading-7 tracking-[0.05em] text-zinc-300">
                    {fragment.text}
                  </p>
                </article>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function ObservationLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-5 border-b border-zinc-900/60 pb-3 last:border-b-0">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-100">{value}</span>
    </div>
  );
}
