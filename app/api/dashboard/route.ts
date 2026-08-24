import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// 埋点看板 API：服务端直连 Supabase（service_role 读权限）聚合 visit_logs 漏斗，返回 JSON。
// 前端 BeginHere 的 /dashboard 页面调用它渲染，用户无需再跑本地脚本。
// 鉴权：DASHBOARD_TOKEN 环境变量（?token= 或 x-dashboard-token 头）。
// 与 client/scripts/dashboard.mjs 同口径：前缀交集按设备去重，保证后一层 ≤ 前一层。

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

type Row = { device_id: string; event_name: string; payload?: Record<string, unknown> | null; created_at: string }

const FUNNEL_A: [string, string, string?][] = [
  ['home_view', '看到首页'],
  ['emotion_start', '开始倾诉'],
  ['emotion_submit', '提交情绪'],
  ['persona_select', '选择人格'],
  ['chat_start', '进入对话'],
  ['egg_offered', '看到 offer', 'chat'],
  ['chat_complete', '完成倾诉', 'chat'],
  ['receipt_generated', '生成小票'],
  ['receipt_viewed', '看到小票'],
  ['object_saved', '保存物件'],
  ['object_share', '分享物件'],
]
const FUNNEL_B: [string, string, string?][] = [
  ['home_view', '看到首页'],
  ['discovery_egg_offered', '发现彩蛋'],
  ['discovery_egg_accepted', '接受彩蛋'],
  ['discovery_egg_completed', '做到了'],
  ['receipt_generated', '生成小票'],
  ['receipt_viewed', '看到小票'],
  ['object_saved', '保存物件'],
]
// 漏斗 B 里的「没做」是与「做到了」互斥的旁支，不能进链条（否则交集≈0）
// 单独用指标统计：接受后明确报「没做」的设备数
const FUNNEL_C: [string, string, string?][] = [
  ['home_view', '看到首页'],
  ['chat_start', '进入对话'],
  ['egg_offered', '收到彩蛋', 'chat'],
  ['egg_accepted', '接受彩蛋', 'chat'],
  ['egg_feedback_submitted', '彩蛋反馈', 'chat'],
  ['egg_completed', '彩蛋完成', 'chat'],
  ['receipt_generated', '生成小票'],
  ['object_saved', '保存物件'],
]

interface FunnelStep { name: string; ev: string; n: number; rate: number | null }

function buildFunnel(
  events: [string, string, string?][],
  byEvent: Map<string, Set<string>>,
  byFrom: Map<string, Set<string>>,
  custom?: Map<string, Set<string>>,
): FunnelStep[] {
  const steps: FunnelStep[] = []
  let layer: Set<string> | null = null
  for (const [ev, name, from] of events) {
    const key = from ? `${ev}|${from}` : ev
    const done = custom?.get(key) ?? ((from ? byFrom.get(key) : byEvent.get(ev)) || new Set<string>())
    const next: Set<string> =
      layer === null ? new Set(done) : new Set([...layer].filter((d) => done.has(d)))
    layer = next
    const prevSize = steps.length ? steps[steps.length - 1].n : null
    steps.push({ name, ev, n: layer.size, rate: prevSize && prevSize > 0 ? (layer.size / prevSize) * 100 : null })
  }
  return steps
}

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

  const data = includeTests ? rows : rows.filter((r) => !isTest(String(r.device_id)))

  const byEvent = new Map<string, Set<string>>()
  const byFrom = new Map<string, Set<string>>()
  // response 蛋「完成」只统计 payload.completed===true（false 是没做到，不能算完成）
  const eggCompletedTrue = new Set<string>()
  for (const r of data) {
    if (!byEvent.has(r.event_name)) byEvent.set(r.event_name, new Set())
    byEvent.get(r.event_name)!.add(r.device_id)
    const p = r.payload as Record<string, unknown> | null
    const from = p?.from || ''
    const key = `${r.event_name}|${from}`
    if (!byFrom.has(key)) byFrom.set(key, new Set())
    byFrom.get(key)!.add(r.device_id)
    if (r.event_name === 'egg_completed' && p?.completed === true) eggCompletedTrue.add(r.device_id)
  }

  const funnelA = buildFunnel(FUNNEL_A, byEvent, byFrom)
  const funnelB = buildFunnel(FUNNEL_B, byEvent, byFrom)
  const funnelC = buildFunnel(FUNNEL_C, byEvent, byFrom, new Map([['egg_completed|chat', eggCompletedTrue]]))

  const layer = (f: FunnelStep[], ev: string) => f.find((s) => s.ev === ev)?.n ?? 0
  // 漏斗 B 的「接受层」：首页→发现→接受（供旁支「没做」计数）
  const bAcceptedLayer = new Set(
    [...(byEvent.get('discovery_egg_accepted') || new Set())].filter(
      (d) => (byEvent.get('home_view') || new Set()).has(d) && (byEvent.get('discovery_egg_offered') || new Set()).has(d),
    ),
  )
  const bNotCompleted = [...bAcceptedLayer].filter((d) => (byEvent.get('discovery_egg_not_completed') || new Set()).has(d)).length
  const metrics = [
    { label: '首页 → 倾诉', a: layer(funnelA, 'home_view'), b: layer(funnelA, 'emotion_start') },
    { label: '倾诉 → 小票', a: layer(funnelA, 'emotion_submit'), b: layer(funnelA, 'receipt_generated') },
    { label: '进入对话 → 完成倾诉', a: layer(funnelA, 'chat_start'), b: layer(funnelA, 'chat_complete') },
    { label: '发现彩蛋 → 接受', a: layer(funnelB, 'discovery_egg_offered'), b: layer(funnelB, 'discovery_egg_accepted') },
    { label: '接受 → 完成', a: layer(funnelB, 'discovery_egg_accepted'), b: layer(funnelB, 'discovery_egg_completed') },
    { label: '接受 → 明确没做', a: bAcceptedLayer.size, b: bNotCompleted },
    { label: '完成 → 小票', a: layer(funnelB, 'discovery_egg_completed'), b: layer(funnelB, 'receipt_generated') },
    { label: 'response蛋 接受 → 完成', a: layer(funnelC, 'egg_accepted'), b: layer(funnelC, 'egg_completed') },
  ]
  const notes = [
    '对话漏斗（chat_start / chat_complete）自 2026-08-15（V0.3）才埋点，更早的会话不计入对话漏斗，历史窗口下该段数字偏低属正常。',
    '发现彩蛋漏斗里「没做」是与「做到了」互斥的旁支，已单独列为「接受 → 明确没做」指标，不再进链条。',
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
    funnelA,
    funnelB,
    funnelC,
    metrics,
    notes,
    installMetrics,
    exitMetrics,
    referral,
    trend,
    maxTrend,
  }, { headers: corsHeaders() })
}