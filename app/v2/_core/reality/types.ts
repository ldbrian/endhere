export const ENTITY_KINDS = ['OBJECT', 'LOCATION', 'ACTION', 'TIME'] as const;

export type ExtractedEntityKind = (typeof ENTITY_KINDS)[number];

export type RawExtractedEntity = {
  kind?: unknown;
  value?: unknown;
  evidence?: unknown;
  confidence?: unknown;
};

export type ValidatedExtractedEntity = {
  kind: ExtractedEntityKind;
  value: string;
  normalizedValue: string;
  evidence?: string;
  confidence: number;
};

export type RealityValidationResult =
  | { ok: true; entities: ValidatedExtractedEntity[] }
  | { ok: false; reason: string; rejected: unknown };