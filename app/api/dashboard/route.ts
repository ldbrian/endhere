import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// 埋点看板 API：服务端直连 Supabase（service_role 读权限）聚合 visit_logs，返回 JSON。
// 前端 BeginHere 的 /dashboard 页面调用它渲染，用户无需再跑本地脚本。
// 鉴权：DASHBOARD_TOKEN 环境变量（?token= 或 x-dashboard-token 头）。
// 口径：不做「链条交集」漏斗（一旦某步缺埋点会拖垮后面所有数，误导）。
// 只展示「原始去重设备数」+「两两转换率」，每个数字都是真实计数。

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

// 真实设备：eh_device_id 由 crypto.randomUUID() 生成，必然是 UUID 格式。
// 命名设备（first-re / prod-fir 等）或非 UUID 一律视为测试/爬虫，不计入。
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isRealDevice = (id: string) => UUID_RE.test(id) && !isTest(id)

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

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-dashboard-token') || req.nextUrl.searchParams.get('token') || ''
  const expected = process.env.DASHBOARD_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'DASHBOARD_TOKEN_NOT_SET' }, { status: 503, headers: corsHeaders() })
  }
  if (token !== expected) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: corsHeaders() })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !srk) {
    return NextResponse.json({ error: 'SUPABASE_ENV_MISSING' }, { status: 503, headers: corsHeaders() })
  }

  const days = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get('days') ?? 14)))
  const includeTests = req.nextUrl.searchParams.get('includeTests') === '1'

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

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

  const data = includeTests ? rows : rows.filter((r) => isRealDevice(String(r.device_id)))

  const byEvent = new Map<string, Set<string>>()
  const byFrom = new Map<string, Set<string>>()
  // response 蛋「完成」只统计 payload.completed===true（false 是没做到，不能算完成）
  const eggCompletedTrue = new Set<string>()
  // 小票分来源：倾诉路径的 receipt 无 from 字段；彩蛋路径的 receipt 带 from
  const receiptChat = new Set<string>()
  const receiptEgg = new Set<string>()
  for (const r of data) {
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
  // 各路径原始去重设备数（不做链条交集，每个数字都是真实计数）
  const stepCount = (ev: string, from?: string, customSet?: string): number => {
    const set = customSet ? customSets[customSet] : from ? byFrom.get(`${ev}|${from}`) : byEvent.get(ev)
    return set?.size ?? 0
  }
  const paths = [
    { id: 'A', name: '倾诉路径（原始设备数）', steps: PATH_A.map(([ev, label, from, cs]) => ({ ev, label, n: stepCount(ev, from, cs) })) },
    { id: 'B', name: '发现彩蛋路径（原始设备数）', steps: PATH_B.map(([ev, label, from, cs]) => ({ ev, label, n: stepCount(ev, from, cs) })) },
    { id: 'C', name: 'response 蛋路径（原始设备数）', steps: PATH_C.map(([ev, label, from, cs]) => ({ ev, label, n: stepCount(ev, from, cs) })) },
  ]

  // 关键转化指标用「原始设备集合」而不是链条漏斗层：
  // 链条漏斗一旦某一步缺埋点（如 chat_start 仅 V0.3 后有）就会拖垮后面的数，
  // 原始交集是诚实的「做了A又做了B」口径。
  const devs = (ev: string) => byEvent.get(ev) || new Set<string>()
  const inter = (a: Set<string>, b: Set<string>) => new Set([...a].filter((d) => b.has(d)))
  const chatAccepted = byFrom.get('egg_accepted|chat') || new Set<string>()
  const metrics = [
    { label: '首页 → 倾诉', a: devs('home_view').size, b: devs('emotion_start').size },
    { label: '倾诉 → 小票', a: devs('emotion_submit').size, b: inter(devs('emotion_submit'), devs('receipt_generated')).size },
    { label: '进入对话 → 完成倾诉', a: devs('chat_start').size, b: inter(devs('chat_start'), devs('chat_complete')).size },
    { label: '发现彩蛋 → 接受', a: devs('discovery_egg_offered').size, b: inter(devs('discovery_egg_offered'), devs('discovery_egg_accepted')).size },
    { label: '接受 → 完成', a: devs('discovery_egg_accepted').size, b: inter(devs('discovery_egg_accepted'), devs('discovery_egg_completed')).size },
    { label: '接受 → 明确没做', a: devs('discovery_egg_accepted').size, b: inter(devs('discovery_egg_accepted'), devs('discovery_egg_not_completed')).size },
    { label: '完成 → 小票', a: devs('discovery_egg_completed').size, b: inter(devs('discovery_egg_completed'), devs('receipt_generated')).size },
    { label: 'response蛋 接受 → 完成', a: chatAccepted.size, b: inter(chatAccepted, eggCompletedTrue).size },
  ]

  // 彩蛋实验追踪：验证「彩蛋是不是当前最有潜力的核心行为」的唯一指标集。
  // 全部原始去重设备交集，前后对比只用这些数。
  const daysPerDev = new Map<string, Set<string>>()
  for (const r of data) {
    const day = String(r.created_at).slice(0, 10)
    if (!daysPerDev.has(r.device_id)) daysPerDev.set(r.device_id, new Set())
    daysPerDev.get(r.device_id)!.add(day)
  }
  const eggExperiment = {
    homeToDiscovery: inter(devs('home_view'), devs('discovery_egg_offered')).size,
    discoveryToAccept: inter(devs('discovery_egg_offered'), devs('discovery_egg_accepted')).size,
    acceptToDone: inter(devs('discovery_egg_accepted'), devs('discovery_egg_completed')).size,
    doneToFeedback: inter(devs('discovery_egg_completed'), receiptEgg).size,
    eggToPlaza: inter(devs('discovery_egg_accepted'), devs('plaza_view')).size,
    returnVisitors: [...daysPerDev.values()].filter((ds) => ds.size >= 2).length,
  }
  const notes = [
    '本页所有数字都是「原始去重设备数」，不做链条交集——避免某一步缺埋点拖垮后面所有数。',
    'chat_start / chat_complete 自 2026-08-15（V0.3）才埋点，更早的会话这两步为 0 属正常。',
    '「没做」与「做到了」互斥，已作为独立一步展示。',
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
    click: byEvent.get('install_click')?.size ?? 0,
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
    n: [...refDevices.keys()].filter((d) => (byEvent.get(ev) || new Set()).has(d)).length,
  }))
  const referral = {
    count: refDevices.size,
    topRefs: topRefsList,
    funnel: referralFunnel,
  }

  const trendMap = new Map<string, { app_open: number; emotion_start: number; discovery_egg_accepted: number; receipt_generated: number }>()
  for (const r of data) {
    if (!['app_open', 'emotion_start', 'discovery_egg_accepted', 'receipt_generated'].includes(r.event_name)) continue
    const day = String(r.created_at).slice(0, 10)
    if (!trendMap.has(day)) trendMap.set(day, { app_open: 0, emotion_start: 0, discovery_egg_accepted: 0, receipt_generated: 0 })
    trendMap.get(day)![r.event_name as 'app_open' | 'emotion_start' | 'discovery_egg_accepted' | 'receipt_generated'] += 1
  }
  const trend = [...trendMap.keys()].sort().map((d) => ({ day: d.slice(5), ...trendMap.get(d)! }))
  const maxTrend = Math.max(1, ...trend.map((t) => t.app_open))

  return NextResponse.json({
    days,
    includeTests,
    total: data.length,
    devices: new Set(data.map((r) => r.device_id)).size,
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    paths,
    metrics,
    eggExperiment,
    notes,
    installMetrics,
    exitMetrics,
    referral,
    trend,
    maxTrend,
  }, { headers: corsHeaders() })
}