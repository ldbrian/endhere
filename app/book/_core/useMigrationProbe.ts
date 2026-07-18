'use client';

import { useEffect, useRef } from 'react';
import { useFragmentStore } from './storage';
import { createFragmentId, fallbackFragmentTitle, type Fragment } from './fragments';

// 🟢 CTO 修正：精准对齐 V1 的真实存储键名
const V1_STORAGE_KEY = 'entries'; 
const MIGRATION_FLAG = 'endhere_book_migrated';

type V1Entry = {
  content?: string;
  timestamp?: number | string;
};

export function useMigrationProbe() {
  const hasRun = useRef(false);
  
  useEffect(() => {
    if (hasRun.current || typeof window === 'undefined') return;
    hasRun.current = true;

    const isMigrated = window.localStorage.getItem(MIGRATION_FLAG);
    if (isMigrated === 'true') {
      console.log('[Migration Probe] 🔒 锁已生效，跳过迁移。');
      return; 
    }

    try {
      const v1Raw = window.localStorage.getItem(V1_STORAGE_KEY);
      if (!v1Raw) {
        console.warn(`[Migration Probe] ❌ 找不到 V1 旧数据 (键名: ${V1_STORAGE_KEY})！`);
        return;
      }

      const v1Data = JSON.parse(v1Raw);

      // 🟢 降维打击：兼容多重可能的数据嵌套结构
      let v1Entries: V1Entry[] = [];
      if (Array.isArray(v1Data)) {
        v1Entries = v1Data; // 直接是数组
      } else if (v1Data?.state?.entries && Array.isArray(v1Data.state.entries)) {
        v1Entries = v1Data.state.entries; // Zustand 标准 persist 嵌套
      } else if (v1Data?.entries && Array.isArray(v1Data.entries)) {
        v1Entries = v1Data.entries; // 浅层嵌套
      }

      if (v1Entries.length > 0) {
        console.log(`[Migration Probe] 🟢 发现 ${v1Entries.length} 条 V1 旧档案，开始升维...`);
        
        const { ownerId } = useFragmentStore.getState();
        const migratedFragments: Fragment[] = v1Entries.map((oldEntry) => ({
          id: createFragmentId(),
          owner_id: ownerId,
          title: fallbackFragmentTitle(oldEntry.content || ''),
          original_content: oldEntry.content || '',
          narration_content: '（早期遗留档案）',
          visibility: 'private', 
          allow_shopkeeper_review: false,
          is_featured: false,
          shopkeeper_comment: null,
          meta: { source: 'manual' },
          created_at: oldEntry.timestamp ? new Date(oldEntry.timestamp).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        useFragmentStore.setState((state) => ({
          localFragments: [...migratedFragments, ...state.localFragments]
        }));

        console.log(`[Migration Probe] ✅ 成功迁移 ${migratedFragments.length} 块碎片。`);
        
        // 只有真正迁移成功了，才打上封条
        window.localStorage.setItem(MIGRATION_FLAG, 'true');
      } else {
        console.warn('[Migration Probe] ⚠️ 找到了 entries 键，但里面没有有效的数据数组。');
      }

    } catch (err) {
      console.error('[Migration Probe] 迁移异常，中止操作:', err);
    }
  }, []);
}
