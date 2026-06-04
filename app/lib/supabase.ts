import { createClient } from '@supabase/supabase-js';

// 强校验：拦截环境变量缺失
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('CTO 警告: 缺失 Supabase 环境变量 (NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY)。请在 .env.local 中配置。');
}

// 导出唯一的 Supabase 客户端单例
export const supabase = createClient(supabaseUrl, supabaseAnonKey);