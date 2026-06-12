// app/utils/moodTagger.ts

// 极简关键词字典
const HEAVY_KEYWORDS = ['累', '烦', '烂', '痛苦', '死', '毫无意义', '失败', '难受', '糟糕', '熬', '抑郁', '绝望'];
const LIGHT_KEYWORDS = ['开心', '解决', '还行', '舒服', '好转', '平静', '阳光', '放松', '好多了', '顺利', '期待'];

export type MoodTag = 'heavy' | 'light' | 'neutral';

export function tagMood(content: string): MoodTag {
  if (!content) return 'neutral';
  
  let heavyScore = 0;
  let lightScore = 0;

  HEAVY_KEYWORDS.forEach(word => {
    if (content.includes(word)) heavyScore++;
  });

  LIGHT_KEYWORDS.forEach(word => {
    if (content.includes(word)) lightScore++;
  });

  if (heavyScore > lightScore) return 'heavy';
  if (lightScore > heavyScore) return 'light';
  
  return 'neutral';
}

// 批量为历史记录回溯打标的纯函数
export function backfillMoodTags(entries: any[]) {
  let modified = false;
  const updatedEntries = entries.map(entry => {
    if (!entry.mood_tag && entry.content) {
      modified = true;
      return { ...entry, mood_tag: tagMood(entry.content) };
    }
    return entry;
  });
  return { updatedEntries, modified };
}