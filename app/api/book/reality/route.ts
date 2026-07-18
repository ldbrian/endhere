import { realityExtractor, type RealityExtractorProvider } from '../../../book/_core/reality/RealityExtractor';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type ExtractRequest = {
  fragment_text?: unknown;
  provider?: unknown;
  fragment_id?: unknown;
};

function normalizeProvider(value: unknown): RealityExtractorProvider | undefined {
  return value === 'openai' || value === 'anthropic' ? value : undefined;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ExtractRequest | null;
  const fragmentText = typeof body?.fragment_text === 'string' ? body.fragment_text : '';
  const fragmentId = typeof body?.fragment_id === 'string' ? body.fragment_id : undefined;

  if (!fragmentText.trim()) {
    return Response.json({ error: 'EMPTY_FRAGMENT_TEXT' }, { status: 400 });
  }

  const result = await realityExtractor.extract(fragmentText, {
    provider: normalizeProvider(body?.provider),
  });

  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason, entities: [] }, { status: 422 });
  }

  // 落库逻辑 (静默持久化)
  if (fragmentId) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        for (const entity of result.entities) {
          // 步骤 A：将提取出的 entities 插入（或 upsert）到 extracted_entities 表中
          // 核心依赖是 normalizedValue 和 kind，确保相同的物理实体不会重复创建
          const { data: entityData, error: upsertError } = await supabase
            .from('extracted_entities')
            .upsert(
              {
                kind: entity.kind,
                normalized_value: entity.normalizedValue,
                value: entity.value,
              },
              {
                onConflict: 'kind, normalized_value',
              }
            )
            .select('id')
            .single();

          if (upsertError) {
            console.error('[Extraction Persistence] Upsert entity error:', upsertError);
            continue;
          }

          if (entityData?.id) {
            // 步骤 B：将 fragment_id 和 entity_id 的映射关系插入到 fragment_entities 表
            const { error: linkError } = await supabase.from('fragment_entities').upsert(
              {
                fragment_id: fragmentId,
                entity_id: entityData.id,
                evidence: entity.evidence,
                confidence: entity.confidence,
              },
              {
                onConflict: 'fragment_id, entity_id',
              }
            );

            if (linkError) {
              console.error('[Extraction Persistence] Link fragment error:', linkError);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Extraction Persistence] Unexpected error:', err);
    }
  }

  return Response.json({ ok: true, entities: result.entities });
}
