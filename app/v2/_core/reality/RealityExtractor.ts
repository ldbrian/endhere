import OpenAI from 'openai';
import { realityValidator } from './RealityValidator';
import type { RealityValidationResult, ValidatedExtractedEntity } from './types';
import { checkInput } from '../../../lib/inputGuard';

export type RealityExtractorProvider = 'openai' | 'anthropic';

export type RealityExtractorOptions = {
  provider?: RealityExtractorProvider;
  model?: string;
  apiKey?: string;
  baseURL?: string;
};

export type RealityExtractionResult =
  | { ok: true; provider: RealityExtractorProvider; entities: ValidatedExtractedEntity[]; raw: unknown }
  | { ok: false; provider: RealityExtractorProvider; reason: string; raw: unknown };

export const POLICE_REPORT_SYSTEM_PROMPT = `
You are EndHere Reality Extractor.

Highest rule:
Extract only physical reality coordinates from the user's fragment. Do not infer meaning.

Police report principle:
Write like a quiet police notebook describing what can be seen, heard, touched, located, or timed.
The output is not therapy, not sentiment analysis, not topic modeling, not a summary, and not advice.

Allowed entity kinds only:
- OBJECT: concrete things that could exist in the real world.
- LOCATION: concrete places or spatial positions.
- ACTION: concrete observable actions.
- TIME: concrete or local time expressions.

Forbidden:
- emotions, moods, sentiments, tone, personality, motive, interpretation, diagnosis, life meaning, topic labels, growth labels.
- words like anxiety, sadness, anger, loneliness, security, trauma, avoidance, pleasing, personality, boundary.
- any field except kind, value, evidence, confidence inside each entity.

Return only a JSON object. No Markdown.
The object must be: { "entities": [...] }.
Each item in entities must exactly match:
{ "kind": "OBJECT|LOCATION|ACTION|TIME", "value": "short entity", "evidence": "short quote from fragment", "confidence": 0.0-1.0 }

If the fragment has no extractable physical coordinates, return { "entities": [] }.
`;

function providerFromOptions(options: RealityExtractorOptions): RealityExtractorProvider {
  return options.provider || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');
}

function parseJsonEntities(raw: string): unknown {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');

  if (objectStart >= 0 && objectEnd >= objectStart) {
    const parsed = JSON.parse(cleaned.slice(objectStart, objectEnd + 1)) as { entities?: unknown };
    return Array.isArray(parsed.entities) ? parsed.entities : parsed;
  }

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart < 0 || arrayEnd < arrayStart) throw new Error('REALITY_EXTRACTOR_NO_JSON_ENTITIES');
  return JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1));
}

export class RealityExtractor {
  async extract(fragmentText: string, options: RealityExtractorOptions = {}): Promise<RealityExtractionResult> {
    const text = fragmentText.trim();
    const provider = providerFromOptions(options);

    if (!text) return { ok: true, provider, entities: [], raw: [] };

    // 输入守门：长度上限 2000、命中敏感词直接返回空（不污染 LLM、不烧 token）
    const guard = checkInput(text, { min: 1, max: 2000 });
    if (!guard.ok) {
      return {
        ok: false,
        provider,
        reason: `REALITY_EXTRACTOR_INPUT_${guard.reason}`,
        raw: null,
      };
    }

    try {
      const rawText = provider === 'anthropic'
        ? await this.callAnthropic(text, options)
        : await this.callOpenAI(text, options);
      const rawJson = parseJsonEntities(rawText);
      const validation = realityValidator.validate(rawJson);
      return this.toExtractionResult(provider, validation, rawJson);
    } catch (error) {
      return {
        ok: false,
        provider,
        reason: error instanceof Error ? error.message : 'REALITY_EXTRACTOR_FAILED',
        raw: null,
      };
    }
  }

  validate(rawJson: unknown, provider: RealityExtractorProvider = 'openai'): RealityExtractionResult {
    const validation = realityValidator.validate(rawJson);
    return this.toExtractionResult(provider, validation, rawJson);
  }

  private toExtractionResult(
    provider: RealityExtractorProvider,
    validation: RealityValidationResult,
    raw: unknown
  ): RealityExtractionResult {
    if (validation.ok) return { ok: true, provider, entities: validation.entities, raw };
    return { ok: false, provider, reason: validation.reason, raw };
  }

  private async callOpenAI(text: string, options: RealityExtractorOptions) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
    const baseURL = options.baseURL || process.env.OPENAI_BASE_URL || process.env.DEEPSEEK_BASE_URL;
    const model = options.model || process.env.REALITY_EXTRACTOR_MODEL || 'gpt-4.1-mini';

    if (!apiKey) throw new Error('REALITY_EXTRACTOR_OPENAI_KEY_MISSING');

    const client = new OpenAI({ apiKey, baseURL });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: POLICE_REPORT_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    return response.choices[0]?.message?.content || '{"entities":[]}';
  }

  private async callAnthropic(text: string, options: RealityExtractorOptions) {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    const model = options.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
    const baseURL = options.baseURL || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

    if (!apiKey) throw new Error('REALITY_EXTRACTOR_ANTHROPIC_KEY_MISSING');

    const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0,
        system: POLICE_REPORT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) throw new Error(`REALITY_EXTRACTOR_ANTHROPIC_${response.status}`);

    const data = await response.json() as { content?: { type?: string; text?: string }[] };
    return data.content?.find((item) => item.type === 'text')?.text || '{"entities":[]}';
  }
}

export const realityExtractor = new RealityExtractor();