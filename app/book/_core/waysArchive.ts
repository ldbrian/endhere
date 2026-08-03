'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Observation } from '../../lib/ways/lens';

// V6 观察方式：本地档案（localStorage）
// 用户选择的每个角度 + 问句 + 反应 = 一条 Observation。
// 档案只记"用户自己留下了什么"，镜子靠它跨碎片记忆，绝不做标签化总结。
// 与 V5 主书 storage（endhere_v2_storage）分开存放，互不干扰。

type WaysArchiveState = {
  observations: Observation[];
  _hasHydrated: boolean;
  addObservation: (observation: Observation) => void;
  _markHydrated: () => void;
};

export const useWaysArchive = create<WaysArchiveState>()(
  persist(
    (set) => ({
      observations: [],
      _hasHydrated: false,
      addObservation: (observation) =>
        set((state) => ({ observations: [...state.observations, observation] })),
      _markHydrated: () => set({ _hasHydrated: true }),
    }),
    {
      name: 'endhere_v6_ways',
      // 硬化 localStorage：私有模式 / 配额满 / 值损坏都不允许抛错（与 V5 storage 同策略）
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return window.localStorage.getItem(name) ?? null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            window.localStorage.setItem(name, value);
          } catch (e) {
            console.warn('[WaysArchive] 写入失败（容量已满或存储被禁用）:', e);
          }
        },
        removeItem: (name) => {
          try {
            window.localStorage.removeItem(name);
          } catch {
            // 忽略：移除失败不影响内存态
          }
        },
      })),
      version: 1,
      partialize: (state) => ({ observations: state.observations }),
      onRehydrateStorage: () => (state, error) => {
        // 即使恢复失败也必须标记 hydration 完成，避免页面白屏
        useWaysArchive.setState({ _hasHydrated: true });
        if (error) {
          console.error('[WaysArchive] 恢复失败，已回退到空档案:', error);
        }
      },
    },
  ),
);
