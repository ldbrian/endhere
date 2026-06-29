'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../../lib/supabase';
import {
  FEATURED_SEED_FRAGMENTS,
  createFragmentId,
  createOwnerId,
  type Fragment,
  type FragmentDraft,
} from './fragments';

// ============================================================
// 🟢 Zustand 全局响应式状态管理 (Local-First 架构)
// ============================================================

interface FragmentState {
  ownerId: string;
  localFragments: Fragment[];
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  addLocalFragment: (draft: FragmentDraft) => Fragment;
  mergeShopkeeperComments: (comments: Record<string, string | null>) => void;
  lastSubmitTime: number | null;
  setLastSubmitTime: (time: number) => void;
}

export const useFragmentStore = create<FragmentState>()(
  persist(
    (set, get) => ({
      ownerId: createOwnerId(), // 首次生成后将被持久化锁定
      localFragments: [],
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      
      // 👇 🟢 CTO 修复：在这里补充实际的状态初始值和修改方法
      lastSubmitTime: null,
      setLastSubmitTime: (time) => set({ lastSubmitTime: time }),
      
      addLocalFragment: (draft) => {
        const now = new Date().toISOString();
        const fragment: Fragment = {
          id: createFragmentId(),
          owner_id: get().ownerId,
          title: draft.title,
          original_content: draft.original_content,
          narration_content: draft.narration_content,
          visibility: draft.visibility,
          allow_shopkeeper_review: draft.allow_shopkeeper_review,
          is_featured: false,
          shopkeeper_comment: null,
          meta: { source: 'manual', ai_persona: draft.ai_persona, consent_level: draft.consent_level ?? 1 },
          created_at: now,
          updated_at: now,
        };

        // 1. 本地状态即时更新 (UI 瞬间响应)
        set((state) => ({
          localFragments: [fragment, ...state.localFragments],
        }));

        // 2. 异步发射到云端 (Fire-and-Forget，不阻塞用户)
        syncFragmentToCloud(fragment);

        return fragment;
      },
      mergeShopkeeperComments: (comments) => {
        set((state) => ({
          localFragments: state.localFragments.map((fragment) => {
            if (!(fragment.id in comments)) return fragment;
            const shopkeeperComment = comments[fragment.id]?.trim() || null;

            if (fragment.shopkeeper_comment === shopkeeperComment) return fragment;
            return {
              ...fragment,
              shopkeeper_comment: shopkeeperComment,
            };
          }),
        }));
      },
    }),
    {
      name: 'endhere_v2_storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// ============================================================
// 🟢 异步云端管线 (Async Cloud Pipeline)
// ============================================================

async function syncFragmentToCloud(fragment: Fragment) {
  // 物理断点：私密碎片绝对不允许上云
  if (fragment.visibility === 'private') {
    console.log('[Storage] Private fragment locked in local drawer.');
    return;
  }

  try {
    const { error } = await supabase.from('fragments').insert([fragment]);
    if (error) {
      console.error('[Fragment Sync] Cloud insert failed:', error);
    }
  } catch (err) {
    console.error('[Fragment Sync] Network error:', err);
  }
}

// ============================================================
// 🟢 今日展柜拉取逻辑 (Featured Exhibit)
// ============================================================

export async function getFeaturedExhibitPool(): Promise<Fragment[]> {
  try {
    const { data, error } = await supabase
      .from('fragments')
      .select('*')
      .eq('visibility', 'public')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data && data.length > 0) {
      // 只保留最新 50 条精选公开碎片，老碎片会被 limit 自动挤出首页奖池。
      return data as Fragment[];
    }
  } catch (err) {
    console.error('[Featured Exhibit] Fetch error:', err);
  }

  // 兜底机制：数据库无数据或断网时，使用本地种子
  return FEATURED_SEED_FRAGMENTS;
}

export async function getFeaturedExhibit(): Promise<Fragment> {
  const pool = await getFeaturedExhibitPool();
  return pool[Math.floor(Math.random() * pool.length)];
}
