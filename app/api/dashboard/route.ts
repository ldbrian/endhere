import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// 埋点看板 API：服务端直连 Supabase（service_role 读权限）聚合 visit_logs，返回 JSON。
// 前端 BeginHere 的 /dashboard 页面调用它渲染，用户无需再跑本地脚本。
// 鉴权：DASHBOARD_TOKEN 环境变量（?token= 或 x-dashboard-token 头）。
//
// —— 口径（2026-10-25 Brian 定，这是规矩不是建议）——
// 1. 默认过滤测试设备（我、WorkBuddy 走查浏览器、Brian 的走查机这些固定 device）。
//    原始数只作调试视图（?includeTests=1），不默认给。
// 2. 每个数字必须能回答三件事：设备数还是事件数 / 时间窗几天 / 怎么去重。
//    返回体里带 unit + window + dedupe，前端原样展示，别在前端另编口径。
// 3. 「路径」不是漏斗：每步各算各的设备集合，所以后一步可能比前一步大。
//    名字里必须带「各步骤设备数」，不许长得像漏斗。
// 4. 时间切分：单日视图（?day=YYYY-MM-DD）+ 24 小时桶，一律按东八区切。
// 5. 个位数波动是噪声：日趋势交给前端算 7 天滚动均值，不追单日。

// 东八区（无夏令时）：把 UTC 时间戳换成「中国时间」的日/时
const TZ_MS = 8 * 3600_000
const dayOf = (iso: string) => new Date(Date.parse(iso) + TZ_MS).toISOString().slice(0, 10)
const hourOf = (iso: string) => new Date(Date.parse(iso) + TZ_MS).getUTCHours()

const isTest = (id: string) =>
  /^shot-/.test(id) ||
  /^offer-test-/.test(id) ||
  /^prod-test-/.test(id) ||
  /^dbg-/.test(id) ||
  /^nav-check-/.test(id) ||
  /^ui-check-/.test(id) ||
  /^final-ui-/.test(id) ||
  /^prod-crisis-/.test(id) ||
  /^crisis-test-/.test(id) ||
  /^prod-crisis-ui-/.test(id) ||
  /^obj-check-/.test(id) ||
  /^egg-test-/.test(id) ||
  /^shot-device-/.test(id) ||
  /^offer-test-accept-/.test(id) ||
  /^offer-test-resume-/.test(id) ||
  /^prod-final-/.test(id)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 已核实的测试设备。前两条是读走查浏览器 localStorage.eh_device_id 得到的真身
// （b4c8cb4b 是线上跑出来的、a3b1ca58 是本地 dist 跑的），其余是脚本固定设备号 /
// 10-23 无头脚本一分钟内连点十次产生的设备。加新的一律写这里或环境变量，
// 不要靠「事件多 = 测试」这种猜法。
const BUILTIN_TEST_DEVICES: Record<string, string> = {
  'b4c8cb4b-84b6-403d-bd09-f2a445c4616e': 'WorkBuddy 走查浏览器（无头 Chrome · 线上 b.behere.fun）',
  'a3b1ca58-d480-4d85-85ce-dde9c155cb74': 'WorkBuddy 走查浏览器（无头 Chrome · 本地 dist）',
  'fcd0cac0-c772-487d-8891-b2cd1a5bfe85': '早期走查 profile（10-24 凌晨功能回归）',
  '11111111-2222-3333-4444-555555555555': '昵称联调固定设备号',
  '49612011-bd0a-4c47-bda3-21d4f14eceb8': '无头脚本（10-23 08:41 连点头部按钮）',
  'd78afd79-8777-422f-87c1-8a2f3919eaa9': '无头脚本（10-23 08:45 连点头部按钮）',
  '6f6ecff2-0450-4649-a76c-bd354017b0d2': '无头脚本（10-23 08:51 连点头部按钮）',
  '73fad720-9bfc-4e83-8f8f-4b1396534423': '无头脚本（10-23 08:56 连点头部按钮）',
  // 10-23 07:35–07:54 每 1~4 分钟一个新 profile、连跑同一段轨迹（同一秒连发 app_open/home_view）
  '36a9f4ac-b6fb-4a7a-a3c9-f6716274af24': '无头脚本（10-23 07:35 连跑）',
  'f5279248-25d7-4cee-8ec8-570818833d4c': '无头脚本（10-23 07:36 连跑）',
  '1360070c-0bdb-489f-a8b5-12b78f99bb33': '无头脚本（10-23 07:39 连跑）',
  '16b00ce3-9d07-42df-ac69-f127951329be': '无头脚本（10-23 07:53 连跑）',
}

const splitIds = (s: string | null | undefined): string[] =>
  (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// 环境变量 DASHBOARD_TEST_DEVICES（逗号分隔）给「不改代码也能加一台走查机」留口；
// ?exclude= 给看板上「这台是测试机」的按钮留口（存在浏览器本地、每次请求带上）。
function envTestDevices(): string[] {
  return splitIds(process.env.DASHBOARD_TEST_DEVICES)
}

type Row = { device_id: string; event_name: string; payload?: Record<string, unknown> | null; created_at: string }

// 各路径要展示的原始事件步骤：[event, label, from?, customSet?]
// from 存在 → 用 byFrom(`${ev}|${from}`)；customSet 存在 → 用对应自定义集合
const PATH_A: [string, string, string?, string?][] = [
  ['home_view', '看到首页'],
  ['emotion_start', '开始倾诉'],
  ['emotion_submit', '提交情绪'],
  ['persona_select', '选择人格'],
  ['chat_start', '进入对话'],
  ['chat_complete', '完成倾诉'],
  ['receipt_generated', '生成小票（倾诉路径）', undefined, 'receiptChat'],
  ['object_saved', '保存物件'],
]
const PATH_B: [string, string, string?, string?][] = [
  ['home_view', '看到首页'],
  ['discovery_egg_offered', '发现彩蛋'],
  ['discovery_egg_accepted', '接受彩蛋'],
  ['discovery_egg_completed', '做到了'],
  ['discovery_egg_not_completed', '明确没做'],
  ['receipt_generated', '生成小票（彩蛋路径）', undefined, 'receiptEgg'],
  ['object_saved', '保存物件'],
]
const PATH_C: [string, string, string?, string?][] = [
  ['home_view', '看到首页'],
  ['chat_start', '进入对话'],
  ['egg_offered', '收到彩蛋', 'chat'],
  ['egg_accepted', '接受彩蛋', 'chat'],
  ['egg_feedback_submitted', '彩蛋反馈', 'chat'],
  ['egg_completed', '彩蛋完成', 'chat', 'eggCompletedTrue'],
  ['receipt_generated', '生成小票（彩蛋路径）', undefined, 'receiptEgg'],
  ['object_saved', '保存物件'],
]

function corsHeaders(): Record<string, string> {
  const origin = process.env.CHEST_CORS_ORIGIN || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-dashboard-token',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

// 看板数据不需要实时：60s TTL 缓存，避免每次打开都全量拉取+计算（约 2.5s）
type DashCacheEntry = { t: number; body: unknown }
const dashCache = (globalThis as unknown as { __bhDashCache?: Map<string, DashCacheEntry> }).__bhDashCache ?? new Map<string, DashCacheEntry>()
;(globalThis as unknown as { __bhDashCache?: Map<string, DashCacheEntry> }).__bhDashCache = dashCache
const DASH_CACHE_TTL = 60_000

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-dashboard-token') || req.nextUrl.searchParams.get('token') || ''
  const expected = process.env.DASHBOARD_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'DASHBOARD_TOKEN_NOT_SET' }, { status: 503, headers: corsHeaders() })
  }
  if (token !== expected) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: corsHeaders() })
  }

  const days = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get('days') ?? 14)))
  // 默认看过滤后的数；includeTests=1 才是「原始数（调试视图）」
  const includeTests = req.nextUrl.searchParams.get('includeTests') === '1'
  const extraExcludes = splitIds(req.nextUrl.searchParams.get('exclude'))
  const cacheKey = `${days}|${includeTests}|${extraExcludes.join(',')}`

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !srk) {
    return NextResponse.json({ error: 'SUPABASE_ENV_MISSING' }, { status: 503, headers: corsHeaders() })
  }

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()
  const todayLocal = dayOf(new Date().toISOString())
  const dayParam = (req.nextUrl.searchParams.get('day') || todayLocal).slice(0, 10)
  const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : todayLocal
  const cacheKeyFull = `${cacheKey}|${dayKey}`

  const hit = dashCache.get(cacheKeyFull)
  if (hit && Date.now() - hit.t < DASH_CACHE_TTL) {
    return NextResponse.json(hit.body, { headers: corsHeaders() })
  }

  const rows: Row[] = []
  try {
    let from = 0
    for (;;) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/visit_logs?select=device_id,event_name,payload,created_at&created_at=gt.${encodeURIComponent(sinceIso)}&order=created_at.asc&limit=1000&offset=${from}`,
        { headers: { apikey: srk, Authorization: `Bearer ${srk}` } },
      )
      if (!res.ok) throw new Error(`visit_logs ${res.status}: ${await res.text()}`)
      const page = (await res.json()) as Row[]
      rows.push(...page)
      if (page.length < 1000) break
      from += 1000
    }
  } catch (e) {
    console.error('[Dashboard] fetch visit_logs:', e)
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 502, headers: corsHeaders() })
  }

  // —— 测试设备过滤 ——
  const envIds = new Set(envTestDevices())
  const extraIds = new Set(extraExcludes)
  const testReason = (id: string): string | null => {
    if (!UUID_RE.test(id)) return '非 UUID 设备号（脚本/命名设备）'
    if (isTest(id)) return '测试命名前缀'
    if (BUILTIN_TEST_DEVICES[id]) return BUILTIN_TEST_DEVICES[id]
    if (envIds.has(id)) return '环境变量 DASHBOARD_TEST_DEVICES'
    if (extraIds.has(id)) return '在看板上手动标记'
    return null
  }

  const allDevices = new Set(rows.map((r) => r.device_id))
  const testDevices = [...allDevices]
    .map((id) => {
      const why = testReason(id)
      return why ? { id, why, n: rows.filter((r) => r.device_id === id).length } : null
    })
    .filter((x): x is { id: string; why: string; n: number } => x !== null)
    .sort((a, b) => b.n - a.n)

  const data = includeTests ? rows : rows.filter((r) => testReason(String(r.device_id)) === null)

  // —— 聚合：窗口一份、单日一份，用同一个函数算，口径不会两处不一样 ——
  const aggregate = (list: Row[]) => {
    const byEvent = new Map<string, Set<string>>()
    const byFrom = new Map<string, Set<string>>()
    // response 蛋「完成」只统计 payload.completed===true（false 是没做到，不能算完成）
    const eggCompletedTrue = new Set<string>()
    // 小票分来源：倾诉路径的 receipt 无 from 字段；彩蛋路径的 receipt 带 from
    const receiptChat = new Set<string>()
    const receiptEgg = new Set<string>()
    for (const r of list) {
      if (!byEvent.has(r.event_name)) byEvent.set(r.event_name, new Set())
      byEvent.get(r.event_name)!.add(r.device_id)
      const p = r.payload as Record<string, unknown> | null
      const from = p?.from || ''
      const key = `${r.event_name}|${from}`
      if (!byFrom.has(key)) byFrom.set(key, new Set())
      byFrom.get(key)!.add(r.device_id)
      if (r.event_name === 'egg_completed' && p?.completed === true) eggCompletedTrue.add(r.device_id)
      if (r.event_name === 'receipt_generated') {
        if (p?.from) receiptEgg.add(r.device_id)
        else receiptChat.add(r.device_id)
      }
    }
    const customSets: Record<string, Set<string>> = { eggCompletedTrue, receiptChat, receiptEgg }
    const stepCount = (ev: string, from?: string, customSet?: string): number => {
      const set = customSet ? customSets[customSet] : from ? byFrom.get(`${ev}|${from}`) : byEvent.get(ev)
      return set?.size ?? 0
    }
    const devs = (ev: string) => byEvent.get(ev) || new Set<string>()
    const inter = (a: Set<string>, b: Set<string>) => new Set([...a].filter((d) => b.has(d)))

    return { byEvent, byFrom, devs, inter, stepCount, receiptEgg, eggCompletedTrue }
  }

  const win = aggregate(data)
  const dayRows = data.filter((r) => dayOf(r.created_at) === dayKey)
  const dayAgg = aggregate(dayRows)

  const pathMeta = {
    // 名字里必须写清「各步骤设备数」：每步独立统计设备，后一步可能比前一步大，这不是 bug
    unit: 'device' as const,
    dedupe: '每步：同一设备在窗口内做过该事件 1 次即计 1，不要求先做过上一步',
  }
  const paths = [
    { id: 'A', name: '倾诉 · 各步骤设备数（非漏斗）', steps: PATH_A.map(([ev, label, from, cs]) => ({ ev, label, n: win.stepCount(ev, from, cs) })) },
    { id: 'B', name: '发现彩蛋 · 各步骤设备数（非漏斗）', steps: PATH_B.map(([ev, label, from, cs]) => ({ ev, label, n: win.stepCount(ev, from, cs) })) },
    { id: 'C', name: 'response 蛋 · 各步骤设备数（非漏斗）', steps: PATH_C.map(([ev, label, from, cs]) => ({ ev, label, n: win.stepCount(ev, from, cs) })) },
  ]

  // 交叉转化率：用「原始设备集合的交集」，明确是「做过 A 又做过 B」，
  // 不是「A 之后接着 B」——链条顺序不保证，别当漏斗读。
  const chatAccepted = win.byFrom.get('egg_accepted|chat') || new Set<string>()
  const metrics = [
    { label: '首页 → 倾诉', a: win.devs('home_view').size, b: win.devs('emotion_start').size },
    { label: '倾诉 → 小票', a: win.devs('emotion_submit').size, b: win.inter(win.devs('emotion_submit'), win.devs('receipt_generated')).size },
    { label: '进入对话 → 完成倾诉', a: win.devs('chat_start').size, b: win.inter(win.devs('chat_start'), win.devs('chat_complete')).size },
    { label: '发现彩蛋 → 接受', a: win.devs('discovery_egg_offered').size, b: win.inter(win.devs('discovery_egg_offered'), win.devs('discovery_egg_accepted')).size },
    { label: '接受 → 完成', a: win.devs('discovery_egg_accepted').size, b: win.inter(win.devs('discovery_egg_accepted'), win.devs('discovery_egg_completed')).size },
    { label: '接受 → 明确没做', a: win.devs('discovery_egg_accepted').size, b: win.inter(win.devs('discovery_egg_accepted'), win.devs('discovery_egg_not_completed')).size },
    { label: '完成 → 小票', a: win.devs('discovery_egg_completed').size, b: win.inter(win.devs('discovery_egg_completed'), win.devs('receipt_generated')).size },
    { label: 'response蛋 接受 → 完成', a: chatAccepted.size, b: win.inter(chatAccepted, win.eggCompletedTrue).size },
  ]

  // 彩蛋实验追踪：验证「彩蛋是不是当前最有潜力的核心行为」的唯一指标集。
  const daysPerDev = new Map<string, Set<string>>()
  for (const r of data) {
    const d = dayOf(r.created_at)
    if (!daysPerDev.has(r.device_id)) daysPerDev.set(r.device_id, new Set())
    daysPerDev.get(r.device_id)!.add(d)
  }
  const eggExperiment = {
    homeToDiscovery: win.inter(win.devs('home_view'), win.devs('discovery_egg_offered')).size,
    discoveryToAccept: win.inter(win.devs('discovery_egg_offered'), win.devs('discovery_egg_accepted')).size,
    acceptToDone: win.inter(win.devs('discovery_egg_accepted'), win.devs('discovery_egg_completed')).size,
    doneToFeedback: win.inter(win.devs('discovery_egg_completed'), win.receiptEgg).size,
    eggToPlaza: win.inter(win.devs('discovery_egg_accepted'), win.devs('plaza_view')).size,
    returnVisitors: [...daysPerDev.values()].filter((ds) => ds.size >= 2).length,
  }

  const notes = [
    `默认已过滤 ${testDevices.length} 台测试设备（我和走查浏览器）。要看原始数请开「调试视图」。`,
    '「各步骤设备数」不是漏斗：每步独立统计设备，后一步比前一步大是正常的（比如直接落到对话页的设备）。',
    'chat_start / chat_complete 自 2026-08-15（V0.3）才埋点，更早的会话这两步为 0 属正常。',
    '个位数波动是噪声：看 7 天滚动均值，不要拿今天和昨天比。',
  ]

  const exitMap = new Map<string, Set<string>>()
  for (const r of data) {
    if (r.event_name === 'exit_to_endhere' || r.event_name === 'exit_to_beginhere') {
      if (!exitMap.has(r.event_name)) exitMap.set(r.event_name, new Set())
      exitMap.get(r.event_name)!.add(r.device_id)
    }
  }
  const exitMetrics = [
    { label: 'BH → EH 出口', ev: 'exit_to_endhere' },
    { label: 'EH → BH 出口', ev: 'exit_to_beginhere' },
  ].map((m) => ({ ...m, n: (exitMap.get(m.ev) || new Set()).size }))

  const installAccepted = new Set<string>()
  const feedbackDevices = new Set<string>()
  for (const r of data) {
    if (r.event_name === 'install_result' && (r.payload as Record<string, unknown> | null)?.outcome === 'accepted') installAccepted.add(r.device_id)
    if (r.event_name === 'feedback_submit') feedbackDevices.add(r.device_id)
  }
  const installMetrics = {
    click: win.byEvent.get('install_click')?.size ?? 0,
    accepted: installAccepted.size,
    feedback: feedbackDevices.size,
  }

  // 分享裂变：referral_open 记「被谁带来」，同设备只计一次；按 ref 汇总每个分享者带来的新用户
  const refDevices = new Map<string, string>()
  for (const r of data) {
    if (r.event_name !== 'referral_open') continue
    const ref = String((r.payload as Record<string, unknown> | null)?.ref || '')
    if (ref && !refDevices.has(r.device_id)) refDevices.set(r.device_id, ref)
  }
  const topRefs = new Map<string, number>()
  for (const ref of refDevices.values()) topRefs.set(ref, (topRefs.get(ref) ?? 0) + 1)
  const topRefsList = [...topRefs.entries()]
    .map(([ref, count]) => ({ ref, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
  const referralFunnel = ['home_view', 'emotion_start', 'chat_start', 'receipt_generated', 'object_saved'].map((ev) => ({
    ev,
    n: [...refDevices.keys()].filter((d) => (win.byEvent.get(ev) || new Set()).has(d)).length,
  }))
  const referral = { count: refDevices.size, topRefs: topRefsList, funnel: referralFunnel }

  // —— 时间切分 ——
  // 每日趋势：事件数（单位写清楚，别让人误读成设备数）+ 设备数 + 窗口内首次出现的设备
  const dayBuckets = new Map<string, { events: number; devs: Set<string>; ev: Record<string, number> }>()
  const firstSeenDay = new Map<string, string>()
  const trendEvents = ['app_open', 'emotion_start', 'discovery_egg_accepted', 'receipt_generated'] as const
  for (const r of data) {
    const d = dayOf(r.created_at)
    if (!dayBuckets.has(d)) dayBuckets.set(d, { events: 0, devs: new Set(), ev: {} })
    const b = dayBuckets.get(d)!
    b.events += 1
    b.devs.add(r.device_id)
    b.ev[r.event_name] = (b.ev[r.event_name] || 0) + 1
    const fs = firstSeenDay.get(r.device_id)
    if (!fs || d < fs) firstSeenDay.set(r.device_id, d)
  }
  const newByDay = new Map<string, number>()
  for (const d of firstSeenDay.values()) newByDay.set(d, (newByDay.get(d) || 0) + 1)
  const daily = [...dayBuckets.keys()].sort().map((d) => {
    const b = dayBuckets.get(d)!
    return {
      day: d,
      events: b.events,
      devices: b.devs.size,
      newDevices: newByDay.get(d) || 0,
      app_open: b.ev.app_open || 0,
      emotion_start: b.ev.emotion_start || 0,
      discovery_egg_accepted: b.ev.discovery_egg_accepted || 0,
      receipt_generated: b.ev.receipt_generated || 0,
    }
  })
  const trend = daily.map((d) => ({ ...d, day: d.day.slice(5) }))
  const maxTrend = Math.max(1, ...daily.map((d) => d.events))

  // 单日视图：这一天里的各步骤设备数 + 24 小时桶（东八区）
  const hourly = Array.from({ length: 24 }, (_, h) => ({ h, events: 0, devices: 0, newDevices: 0 }))
  const hourDevs = Array.from({ length: 24 }, () => new Set<string>())
  const firstSeenIso = new Map<string, string>()
  for (const r of data) {
    const cur = firstSeenIso.get(r.device_id)
    if (!cur || r.created_at < cur) firstSeenIso.set(r.device_id, r.created_at)
  }
  for (const r of dayRows) {
    const h = hourOf(r.created_at)
    hourly[h].events += 1
    hourDevs[h].add(r.device_id)
  }
  hourly.forEach((b, h) => { b.devices = hourDevs[h].size })
  // 当天首次出现（窗口内首次）的设备落在哪个小时：用来做「某时段有没有抬升」的时间对照
  for (const [dev, iso] of firstSeenIso) {
    if (dayOf(iso) !== dayKey) continue
    hourly[hourOf(iso)].newDevices += 1
    void dev
  }
  const dayView = {
    date: dayKey,
    events: dayRows.length,
    devices: new Set(dayRows.map((r) => r.device_id)).size,
    newDevices: hourly.reduce((s, b) => s + b.newDevices, 0),
    steps: PATH_B.map(([ev, label, from, cs]) => ({ ev, label, n: dayAgg.stepCount(ev, from, cs) })),
    hourly,
  }

  // 设备清单（前 12 台，按事件数）：给「这台是测试机」的手动标记留入口——
  // 我和走查浏览器能写死在代码里，Brian 自己的走查机只能由他自己点一下。
  const devAgg = new Map<string, { n: number; first: string; last: string }>()
  for (const r of data) {
    const cur = devAgg.get(r.device_id)
    if (!cur) devAgg.set(r.device_id, { n: 1, first: r.created_at, last: r.created_at })
    else { cur.n += 1; cur.last = r.created_at }
  }
  const topDevices = [...devAgg.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 12)
    .map(([id, v]) => ({ id, n: v.n, first: v.first.slice(0, 16).replace('T', ' '), last: v.last.slice(0, 16).replace('T', ' ') }))

  // —— 入口来源（2026-10-25 新埋点，只有这一处）——
  // 天花板写在返回里，免得有人拿它当精确归因：笔记文末地址已删，用户只能搜名字进来，
  // referrer 多半是空的或搜索引擎中转，能做的上限是「时间对照」。
  const entryDevices = new Map<string, { kind: string; page: string; referrer: string }>()
  for (const r of data) {
    if (r.event_name !== 'entry_landing') continue
    if (entryDevices.has(r.device_id)) continue
    const p = (r.payload || {}) as Record<string, unknown>
    entryDevices.set(r.device_id, {
      kind: String(p.kind || 'unknown'),
      page: String(p.page || '(未知)'),
      referrer: String(p.referrer || ''),
    })
  }
  const byKind = new Map<string, number>()
  const byPage = new Map<string, number>()
  const byRefHost = new Map<string, number>()
  for (const v of entryDevices.values()) {
    byKind.set(v.kind, (byKind.get(v.kind) || 0) + 1)
    byPage.set(v.page, (byPage.get(v.page) || 0) + 1)
    let host = '(无 referrer)'
    if (v.referrer) {
      try { host = new URL(v.referrer).hostname.replace(/^www\./, '') } catch { host = v.referrer.slice(0, 30) }
    }
    byRefHost.set(host, (byRefHost.get(host) || 0) + 1)
  }
  const entry = {
    total: entryDevices.size,
    byKind: [...byKind.entries()].map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n),
    byPage: [...byPage.entries()].map(([page, n]) => ({ page, n })).sort((a, b) => b.n - a.n),
    byRefHost: [...byRefHost.entries()].map(([host, n]) => ({ host, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    ceiling: '笔记文末已删地址，用户只能搜名字进来，归因天然弱：只能看时间对照（某天某时段有没有抬升），不能精确到「这 5 个人是看了笔记来的」。',
  }

  const body = {
    days,
    includeTests,
    day: dayView,
    // 口径三件套：单位 / 时间窗 / 去重规则。前端原样展示，不许另编。
    unit: 'device',
    window: { days, from: dayOf(sinceIso), to: todayLocal, tz: 'UTC+8' },
    dedupe: '设备数：同一设备在窗口内只计 1 次；事件数：不去重，按条计。',
    total: data.length,
    devices: new Set(data.map((r) => r.device_id)).size,
    deviceCounts: {
      all: allDevices.size,
      excludedAsTest: testDevices.length,
      counted: new Set(data.map((r) => r.device_id)).size,
    },
    testDevices,
    topDevices,
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }),
    paths,
    pathMeta,
    metrics,
    eggExperiment,
    notes,
    installMetrics,
    exitMetrics,
    referral,
    daily,
    trend,
    maxTrend,
    entry,
  }
  dashCache.set(cacheKeyFull, { t: Date.now(), body })
  return NextResponse.json(body, { headers: corsHeaders() })
}
