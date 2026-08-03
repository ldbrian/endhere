// ============================================================
// /api/book/ways —— V6 观察方式引擎入口
// ------------------------------------------------------------
// 阶段一：POST { original_content }         → 返回三个观察入口（排序自适应碎片）
// 阶段二：POST { original_content, lens_id } → 返回该观察方式的一个问句
//
// 与 /api/book/organize（V5 回应）并存，互不干扰。
// 注意：这里对敏感内容不做关键词拦截（blockPatterns: false），
// 因为真在痛的人需要被接住，而不是被拒之门外；只做长度/空值校验。
// ============================================================

import { NextResponse } from 'next/server'
import { checkInput, createRateLimiter, getRequestIp } from '../../../lib/inputGuard'
import { LENSES, getLens, type LensId } from '../../../lib/ways/lens'
import { orderEntrances } from '../../../lib/ways/selection'
import { generateAngle, WaysError } from '../../../lib/ways/generate'

export const runtime = 'edge'

// 同一 IP 每小时最多 12 次：够探索，防刷爆 token 预算
const waysLimiter = createRateLimiter({ max: 12, windowMs: 60 * 60 * 1000 })

export async function POST(req: Request) {
  const ip = getRequestIp(req)
  if (!waysLimiter.check(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: { original_content?: unknown; lens_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const fragment = String(body.original_content ?? '').trim()
  const guard = checkInput(fragment, { max: 2000, blockPatterns: false })
  if (!guard.ok) {
    return NextResponse.json({ error: 'invalid_content' }, { status: 400 })
  }

  // ── 阶段一：返回三个观察入口 ──
  if (body.lens_id === undefined || body.lens_id === null) {
    const order = orderEntrances(fragment)
    return NextResponse.json({
      entrances: order.map((id) => ({
        lens_id: id,
        label: LENSES[id].label,
        entrance: LENSES[id].entrance,
      })),
    })
  }

  // ── 阶段二：生成该观察方式的一个问句 ──
  const lensId = String(body.lens_id)
  const lens = getLens(lensId)
  if (!lens) {
    return NextResponse.json({ error: 'unknown_lens' }, { status: 400 })
  }

  try {
    const { question, angleNote } = await generateAngle(lensId as LensId, fragment)
    return NextResponse.json({
      lens_id: lensId as LensId,
      question,
      angle_note: angleNote,
    })
  } catch (err) {
    if (err instanceof WaysError && err.message === 'LLM_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'llm_not_configured' }, { status: 503 })
    }
    console.error('[Ways] generateAngle failed:', err)
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 })
  }
}
