import {
  ENTITY_KINDS,
  type ExtractedEntityKind,
  type RawExtractedEntity,
  type RealityValidationResult,
  type ValidatedExtractedEntity,
} from './types';
import { ENTITY_ALLOWLIST, FORBIDDEN_ENTITY_KEYS, FORBIDDEN_ENTITY_VALUES } from './allowlist';

const MAX_ENTITIES = 24;
const MAX_VALUE_LENGTH = 24;
const ALLOWED_KEYS = new Set(['kind', 'value', 'evidence', 'confidence']);
const ENTITY_KIND_SET = new Set<string>(ENTITY_KINDS);

export class RealityValidator {
  validate(input: unknown): RealityValidationResult {
    if (!Array.isArray(input)) {
      return { ok: false, reason: 'REALITY_REJECT_NOT_ARRAY', rejected: input };
    }

    if (input.length > MAX_ENTITIES) {
      return { ok: false, reason: 'REALITY_REJECT_TOO_MANY_ENTITIES', rejected: input };
    }

    const entities: ValidatedExtractedEntity[] = [];

    for (const item of input) {
      const parsed = this.validateOne(item);
      if (!parsed.ok) return parsed;
      entities.push(parsed.entities[0]);
    }

    return { ok: true, entities: dedupeEntities(entities) };
  }

  private validateOne(item: unknown): RealityValidationResult {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, reason: 'REALITY_REJECT_ENTITY_NOT_OBJECT', rejected: item };
    }

    const record = item as RawExtractedEntity & Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!ALLOWED_KEYS.has(key)) {
        return { ok: false, reason: `REALITY_REJECT_FORBIDDEN_KEY:${key}`, rejected: item };
      }
      if (FORBIDDEN_ENTITY_KEYS.includes(key.toLowerCase() as (typeof FORBIDDEN_ENTITY_KEYS)[number])) {
        return { ok: false, reason: `REALITY_REJECT_NON_ENTITY_KEY:${key}`, rejected: item };
      }
    }

    const kind = typeof record.kind === 'string' ? record.kind.trim().toUpperCase() : '';
    if (!ENTITY_KIND_SET.has(kind)) {
      return { ok: false, reason: `REALITY_REJECT_KIND:${kind || 'EMPTY'}`, rejected: item };
    }

    const value = typeof record.value === 'string' ? record.value.trim() : '';
    if (!value || value.length > MAX_VALUE_LENGTH) {
      return { ok: false, reason: 'REALITY_REJECT_VALUE_LENGTH', rejected: item };
    }

    if (containsForbiddenValue(value)) {
      return { ok: false, reason: `REALITY_REJECT_NON_ENTITY_VALUE:${value}`, rejected: item };
    }

    const entityKind = kind as ExtractedEntityKind;
    if (!matchesAllowlist(entityKind, value)) {
      return { ok: false, reason: `REALITY_REJECT_ALLOWLIST:${entityKind}:${value}`, rejected: item };
    }

    const evidence = typeof record.evidence === 'string' ? record.evidence.trim().slice(0, 80) : undefined;
    const confidence = normalizeConfidence(record.confidence);

    return {
      ok: true,
      entities: [
        {
          kind: entityKind,
          value,
          normalizedValue: normalizeEntityValue(value),
          evidence,
          confidence,
        },
      ],
    };
  }
}

export const realityValidator = new RealityValidator();

export function normalizeEntityValue(value: string) {
  return value.trim().toLowerCase().replace(/[\s。！？,.，、；;：:（）()「」『』“”"'`]+/g, '');
}

function normalizeConfidence(value: unknown) {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 1;
  return Math.max(0, Math.min(1, number));
}

function matchesAllowlist(kind: ExtractedEntityKind, value: string) {
  const normalized = normalizeEntityValue(value);
  return ENTITY_ALLOWLIST[kind].some((allowed) => {
    const normalizedAllowed = normalizeEntityValue(allowed);
    return normalized === normalizedAllowed || normalized.includes(normalizedAllowed) || normalizedAllowed.includes(normalized);
  });
}

function containsForbiddenValue(value: string) {
  const normalized = normalizeEntityValue(value);
  return FORBIDDEN_ENTITY_VALUES.some((forbidden) => normalized.includes(normalizeEntityValue(forbidden)));
}

function dedupeEntities(entities: ValidatedExtractedEntity[]) {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.kind}:${entity.normalizedValue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}