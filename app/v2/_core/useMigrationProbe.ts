'use client';

import { useEffect, useRef } from 'react';
import { useFragmentStore } from './storage';
import { createFragmentId, fallbackFragmentTitle, type Fragment } from './fragments';

// 假设 V1 的 Zustand persist key 是这个，如果不是请替换
const V1_STORAGE_KEY = 'shelter-storage'; 
const V2_MIGRATION_FLAG = 'endhere_v2_migrated';

export function useMigrationProbe() {
  const hasRun = useRef(false);
  
  useEffect(() => {
    // 1. 防止开发环境下 StrictMode 触发两次，以及避免重复迁移
    if (hasRun.current || typeof window === 'undefined') return;
    hasRun.current = true;

    const isMigrated = window.localStorage.getItem(V2_MIGRATION_FLAG);
    if (isMigrated === 'true') return; // 已经迁移过，直接退出

    try {
      // 2. 探针：寻找 V1 旧数据
      const v1Raw = window.localStorage.getItem(V1_STORAGE_KEY);
      if (!v1Raw) {
        // 如果连 V1 数据都没有，说明是纯新用户，直接打上标记即可
        window.localStorage.setItem(V2_MIGRATION_FLAG, 'true');
        return;
      }

      // 3. 解析 V1 数据结构
      const v1Data = JSON.parse(v1Raw);
      const v1Entries = v1Data?.state?.entries; // Zustand 默认的 persist 结构

      if (Array.isArray(v1Entries) && v1Entries.length > 0) {
        console.log('[Migration Probe] 发现 V1 旧档案，开始静默升维...');
        
        // 4. 数据降维打击与映射
        const { ownerId } = useFragmentStore.getState();
        const migratedFragments: Fragment[] = v1Entries.map((oldEntry: any) => ({
          id: createFragmentId(),
          owner_id: ownerId,
          title: fallbackFragmentTitle(oldEntry.content || ''),
          original_content: oldEntry.content || '',
          narration_content: '（早期遗留档案）', // 依照 PRD 补充历史旁白
          visibility: 'private', // 历史数据绝对保护，默认设为私有
          allow_shopkeeper_review: false,
          shopkeeper_comment: null,
          meta: { source: 'manual' },
          created_at: oldEntry.timestamp ? new Date(oldEntry.timestamp).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        // 5. 暴力注入 V2 Store (绕过单条 add 逻辑，直接全量并入)
        useFragmentStore.setState((state) => ({
          localFragments: [...migratedFragments, ...state.localFragments]
        }));

        console.log(`[Migration Probe] 成功迁移 ${migratedFragments.length} 块碎片。`);
      }

      // 6. 贴上封条：宣布迁移完成
      window.localStorage.setItem(V2_MIGRATION_FLAG, 'true');
      
      // 注意：我们不删除 V1_STORAGE_KEY 的旧数据，作为灾备冗余保留。

    } catch (err) {
      console.error('[Migration Probe] 迁移异常，中止操作:', err);
    }
  }, []);
}