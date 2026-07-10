import type { FragmentPersonaId } from './personas';

export type FragmentVisibility = 'private' | 'public';
export type { FragmentPersonaId };
export type FragmentConsentLevel = 1 | 2 | 3;

// Artifact（伴生物）：Fragment 保存后由 AI 生成的一件日常小物件
export type FragmentArtifact = {
  emoji: string;
  name: string;
};

export type Fragment = {
  id: string;
  owner_id: string;
  title: string;
  original_content: string;
  narration_content: string;
  visibility: FragmentVisibility;
  allow_shopkeeper_review: boolean;
  is_featured: boolean;
  shopkeeper_comment: string | null;
  meta: {
    source: 'manual' | 'seed' | 'system';
    ai_persona?: FragmentPersonaId;
    consent_level?: FragmentConsentLevel;
    featured?: boolean;
    quality_score?: number;
    artifact?: FragmentArtifact;
  };
  created_at: string;
  updated_at: string;
};

export type FragmentDraft = {
  title: string;
  original_content: string;
  narration_content: string;
  visibility: FragmentVisibility;
  allow_shopkeeper_review: boolean;
  ai_persona?: FragmentPersonaId;
  consent_level?: FragmentConsentLevel;
  artifact?: FragmentArtifact;
};

export const V2_OWNER_KEY = 'endhere_v2_owner_id';
export const V2_FRAGMENTS_KEY = 'endhere_v2_fragments';

export const FEATURED_SEED_FRAGMENTS: Fragment[] = [
  {
    id: 'seed-featured-cd',
    owner_id: 'seed',
    title: '一张老旧的CD',
    original_content: '今天搬家时翻出一张旧CD。已经播不了了。盒子边缘有一点裂开，封面上的字也褪色了。',
    narration_content: '它已经不再发声，但仍然保留着某段时间留下的形状。',
    visibility: 'public',
    allow_shopkeeper_review: false,
    is_featured: true,
    shopkeeper_comment: null,
    meta: {
      source: 'seed',
      featured: true,
      quality_score: 92,
      artifact: { emoji: '💿', name: '一张播不动了的旧CD' },
    },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-featured-ticket',
    owner_id: 'seed',
    title: '一张褪色的车票',
    original_content: '旧书里夹着一张很久以前的车票。已经想不起那天去了哪里，只记得风很大。',
    narration_content: '出发时间被折痕压住，目的地也变得不那么重要。',
    visibility: 'public',
    allow_shopkeeper_review: false,
    is_featured: true,
    shopkeeper_comment: null,
    meta: {
      source: 'seed',
      featured: true,
      quality_score: 88,
      artifact: { emoji: '🎫', name: '一张折痕压住时间的旧车票' },
    },
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
];

export function createOwnerId() {
  return `local_${crypto.randomUUID()}`;
}

export function createFragmentId() {
  return `fragment_${crypto.randomUUID()}`;
}

export function normalizeFragmentText(text: string) {
  return text.trim().replace(/\r\n/g, '\n');
}

export function clampNarrationToOriginal(narration: string, original: string) {
  const compact = narration.trim();
  const hasOriginal = original.trim().length > 0;
  const maxLength = 60;

  if (!hasOriginal) return '';
  return compact.length > maxLength ? compact.slice(0, maxLength) : compact;
}

export function fallbackFragmentTitle(original: string) {
  const firstLine = normalizeFragmentText(original).split('\n')[0] || '一块碎片';
  return firstLine.length > 12 ? `${firstLine.slice(0, 10)}...` : firstLine;
}
