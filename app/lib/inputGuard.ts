// 输入守门人 —— 把 LLM API 入口前的三件事统一抽到这里：
// 1. 敏感词正则：命中直接 400，不进 LLM（省 token 流量 + 合规底线）
// 2. 长度校验：超限直接 400，防止单请求烧爆 token 预算
// 3. IP 频率限制：基于内存 Map，同一 IP 在窗口期内的请求数有上限
//
// 抽自原 app/api/basket/put/route.ts 的成熟样例，仅供 v2 LLM 入口共享。
// 注意：内存 Map 在 edge runtime 冷启动会重置 —— 重新迫近限速而不
// 是绝对精确的配额。够 MVP 用。

// ------------------------------------------------------------
// 敏感词正则：命中即拒，不走 LLM
// ------------------------------------------------------------
export const BLOCKED_PATTERNS: RegExp[] = [
  // 自杀/自伤
  /自杀|自残|去死|想死|死[一了]死|割腕|轻生|跳楼|跳桥|上吊|烧炭/,
  // 严重谩骂
  /操你|妈的|fuck|shit|你妈|傻[逼屄]|[滚去]你的|废物.*死/i,
  // 色情
  /做爱|性交|插入|射精|勃起|阴茎|阴道|口交|肛交/,
  // 政治敏感（基础）
  /天安门事件|六四|法轮功|台独|藏独|xinjiang.*camp/i,
  // 广告/引流
  /加我微信|扫码|私信|vx:|wx:|qq群|telegram|discord.*邀请/i,
  // 联系方式（手机号 / 座机）
  /1[3-9]\d{9}|(\d{3,4}[-\s]?\d{7,8})/,
];

export type InputGuardResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: 'BLOCKED_CONTENT' | 'TOO_LONG' | 'TOO_SHORT' | 'EMPTY' };

export type InputGuardOptions = {
  min?: number;
  max: number;
  /** 默认 true：命中敏感词返回 BLOCKED_CONTENT。调试场景可关。 */
  blockPatterns?: boolean;
};

export function checkInput(
  text: string,
  options: InputGuardOptions,
): InputGuardResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: 'EMPTY' };
  const min = options.min ?? 0;
  if (trimmed.length < min) return { ok: false, reason: 'TOO_SHORT' };
  if (trimmed.length > options.max) return { ok: false, reason: 'TOO_LONG' };

  if (options.blockPatterns === false) return { ok: true };

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) return { ok: false, reason: 'BLOCKED_CONTENT' };
  }
  return { ok: true };
}

// ------------------------------------------------------------
// IP 频率限制：基于内存 Map，复用 basket/put 的实现
// ------------------------------------------------------------
type RateLimitEntry = { count: number; resetAt: number };

export type RateLimiterOptions = {
  /** 窗口期内允许的最大次数 */
  max: number;
  /** 窗口期，单位毫秒。默认 1 小时 */
  windowMs?: number;
};

export function createRateLimiter({ max, windowMs = 60 * 60 * 1000 }: RateLimiterOptions) {
  // 模块级 Map —— 同一 edge 实例缓存的请求内存共享
  const map = new Map<string, RateLimitEntry>();

  return {
    /** 返回 true 表示通过，返回 false 表示已超限 */
    check(key: string): boolean {
      const now = Date.now();
      const entry = map.get(key);
      if (!entry || now > entry.resetAt) {
        map.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= max) return false;
      entry.count += 1;
      return true;
    },
    /** 仅供测试/调试用，清掉某个 key 或整个 map。 */
    reset(key?: string) {
      if (key) map.delete(key);
      else map.clear();
    },
  };
}

// ------------------------------------------------------------
// 从请求里抽 IP —— 适配 Vercel / 反向代理场景
// ------------------------------------------------------------
export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
