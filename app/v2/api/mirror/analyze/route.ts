import OpenAI from 'openai';

export const runtime = 'edge';

export const MIRROR_SYSTEM_PROMPT =
  '\u4f60\u662f\u4e00\u4e2a\u51b0\u51b7\u3001\u5ba2\u89c2\u7684\u6570\u636e\u7edf\u8ba1\u5f15\u64ce\u3002\u4f60\u7684\u4efb\u52a1\u662f\u4ece\u7528\u6237\u7684\u788e\u7247\u65e5\u8bb0\u4e2d\u63d0\u53d6\u4e8b\u5b9e\u3002\u7edd\u5bf9\u7981\u6b62\u751f\u6210\u4efb\u4f55\u5fc3\u7406\u5b66\u5206\u6790\u3001\u6027\u683c\u8bca\u65ad\u3001\u4eba\u751f\u5efa\u8bae\u6216\u603b\u7ed3\u9648\u8bcd\u3002\u53ea\u8f93\u51fa\u9ad8\u9891\u51fa\u73b0\u7684\u5b9e\u4f53\u540d\u8bcd\u3001\u52a8\u4f5c\u548c\u60c5\u7eea\u5f62\u5bb9\u8bcd\u7684\u6570\u91cf\u7edf\u8ba1\u3002\u4fdd\u6301\u51b7\u9177\uff1a\u4e0d\u89e3\u91ca\u6570\u636e\u7684\u610f\u4e49\u3002\u7528\u6237\u63d0\u4f9b\u4ec0\u4e48\uff0c\u4f60\u5f52\u7c7b\u4ec0\u4e48\u3002';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

type IncomingFragment = { id: string; title?: string; text: string; createdAt?: string };

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeFragment(item: unknown): IncomingFragment | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const text = typeof record.text === 'string' ? record.text.trim() : '';
  if (!id || !text) return null;
  return {
    id,
    title: typeof record.title === 'string' ? record.title.trim().slice(0, 40) : '',
    text: text.slice(0, 700),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
  };
}

function extractJson(raw: string) {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object in mirror response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function fallbackAnalysis(current: IncomingFragment[], previous: IncomingFragment[]) {
  const previousText = previous.map((item) => item.text).join('\n');
  const rows = current.map((fragment, index) => {
    const phrase = fragment.title?.trim() || fragment.text.split(/[\uFF0C\u3002\uFF01\uFF1F\u3001,.!?\s\n\r]+/).map((part) => part.trim()).find((part) => part.length >= 2) || '\u788e\u7247 ' + (index + 1);
    const label = phrase.slice(0, 12);
    return {
      id: 'fallback-' + index,
      label,
      current_count: 1,
      previous_count: previousText.includes(label) ? 1 : 0,
      dominant_sentiment: '\u672a\u6807\u6ce8',
      evidence_ids: [fragment.id],
      latest_fragment_id: fragment.id,
    };
  }).slice(0, 8);

  return {
    source: 'fallback',
    summary: {
      top_topics: rows.slice(0, 3).map((row) => ({ label: row.label, count: row.current_count })),
      sustained_positive_topic: null,
      least_seen_topic: rows.length > 0 ? { label: rows[rows.length - 1].label, count: 1 } : null,
    },
    topics: rows,
    findings: rows.slice(0, 4).map((row) => ({ label: row.label, count: row.current_count, evidence_ids: row.evidence_ids })),
    words: rows.map((row) => ({ label: row.label, count: row.current_count })),
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const current = safeArray(body?.current_fragments).map(normalizeFragment).filter((item): item is IncomingFragment => Boolean(item)).slice(0, 80);
  const previous = safeArray(body?.previous_fragments).map(normalizeFragment).filter((item): item is IncomingFragment => Boolean(item)).slice(0, 80);

  if (current.length === 0) {
    return Response.json({ source: 'ai', summary: { top_topics: [], sustained_positive_topic: null, least_seen_topic: null }, topics: [], findings: [], words: [] });
  }

  if (!process.env.DEEPSEEK_API_KEY || !process.env.DEEPSEEK_BASE_URL) {
    return Response.json(fallbackAnalysis(current, previous));
  }

  const instruction = '\u8bf7\u5206\u6790\u8fd9\u4e9b End Here \u7528\u6237\u788e\u7247\u3002\u53ea\u57fa\u4e8e\u6587\u672c\u4e8b\u5b9e\u8f93\u51fa JSON\uff0c\u4e0d\u8981\u89e3\u91ca\u3001\u4e0d\u8981\u5efa\u8bae\u3001\u4e0d\u8981\u8bca\u65ad\u3002\u8bdd\u9898\u6807\u7b7e\u5fc5\u987b\u6765\u81ea\u788e\u7247\u91cc\u7684\u771f\u5b9e\u5b9e\u4f53/\u4e8b\u4ef6/\u5bf9\u8c61\uff0c\u4e0d\u8981\u4f7f\u7528\u9884\u8bbe\u6a21\u677f\u8bcd\u3002label \u6700\u591a 6 \u4e2a\u6c49\u5b57\uff0ctop_topics 最多 2 \u4e2a\uff0ctopics 最多 6 \u4e2a\uff0cfindings 最多 4 \u4e2a\uff0cwords 最多 6 \u4e2a\u3002count \u8868\u793a\u5305\u542b\u8be5\u8bdd\u9898\u7684\u788e\u7247\u6761\u6570\uff0c\u4e0d\u662f\u8bcd\u9891\u3002evidence_ids \u5fc5\u987b\u4f7f\u7528 current_fragments \u91cc\u7684 id\u3002previous_count \u8868\u793a previous_fragments \u4e2d\u5bf9\u5e94\u8bdd\u9898\u7684\u6761\u6570\u3002\u8f93\u51fa\u7ed3\u6784\uff1a' + '{"summary":{"top_topics":[{"label":"","count":0}],"sustained_positive_topic":null,"least_seen_topic":null},"topics":[{"id":"","label":"","current_count":0,"previous_count":0,"dominant_sentiment":"","evidence_ids":[""],"latest_fragment_id":""}],"findings":[{"label":"","count":0,"evidence_ids":[""]}],"words":[{"label":"","count":0}]}';

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: MIRROR_SYSTEM_PROMPT },
        { role: 'user', content: instruction + '\n\n' + JSON.stringify({ current_fragments: current, previous_fragments: previous }) },
      ],
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });
    const raw = response.choices[0]?.message?.content || '{}';
    return Response.json({ ...extractJson(raw), source: 'ai' });
  } catch (error) {
    console.error('[Mirror Analyze] failed:', error);
    return Response.json(fallbackAnalysis(current, previous));
  }
}