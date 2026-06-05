// hooks/useTraces.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface TraceItem {
  name: string;
  desc: string;
}

export function useTraces() {
  const [traces, setTraces] = useState<TraceItem[]>([]);

  useEffect(() => {
    const fetchTraces = async () => {
      try {
        // 直接抓取世界上所有的 inventory (物品栏/痕迹) 组件
        const { data, error } = await supabase
          .from('entity_components')
          .select('data')
          .eq('component_type', 'inventory');

        if (error) throw error;

        if (data) {
          // 提取所有 items 并扁平化为一个一维数组
          const allItems: TraceItem[] = data.reduce((acc: TraceItem[], curr) => {
            if (curr.data && Array.isArray(curr.data.items)) {
              return [...acc, ...curr.data.items];
            }
            return acc;
          }, []);
          
          setTraces(allItems);
        }
      } catch (err) {
        console.error('Failed to fetch traces:', err);
      }
    };

    fetchTraces();
  }, []);

  return traces;
}