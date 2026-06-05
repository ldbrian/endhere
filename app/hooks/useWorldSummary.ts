// hooks/useWorldSummary.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useWorldSummary() {
  const [summary, setSummary] = useState<string>('...');

  useEffect(() => {
    const fetchLatestSummary = async () => {
      try {
        const { data, error } = await supabase
          .from('world_timeline_logs')
          .select('description')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;
        if (data && data.description) {
          setSummary(data.description);
        }
      } catch (err) {
        console.error('Failed to fetch world summary:', err);
        // 降级兜底，避免白屏
        setSummary('收音机里发出微弱的沙沙声。');
      }
    };

    fetchLatestSummary();
  }, []);

  return summary;
}