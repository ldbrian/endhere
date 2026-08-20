import { NextResponse } from 'next/server'
import { CHEST_EGGS, type EggDef } from '../_pools'

export const runtime = 'edge'

// 按 id 取彩蛋定义（BeginHere 广场「我也想做」入口用）：
// 从共享蛋池直接返回完整字段（含 steps），不走 LLM 重写，保证步骤与文案一致、可恢复。
// 校验：id 是池内已知 id（d1..d15 / a1..a15 / p1..p6），不存在则 404。

function corsHeaders(): Record<string, string> {
  const origin = process.env.CHEST_CORS_ORIGIN || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

function eggPayload(egg: EggDef): Record<string, unknown> {
  const p: Record<string, unknown> = { id: egg.id, text: egg.text }
  if (egg.steps?.length) {
    p.steps = egg.steps
    if (egg.difficulty) p.difficulty = egg.difficulty
    if (egg.estimated_duration) p.estimated_duration = egg.estimated_duration
  }
  return p
}

export async function GET(req: Request) {
  const id = String(new URL(req.url).searchParams.get('id') || '')
  const egg = CHEST_EGGS.find((e) => e.id === id)
  if (!egg) return NextResponse.json({ error: 'egg_not_found' }, { status: 404, headers: corsHeaders() })
  return NextResponse.json(eggPayload(egg), { headers: corsHeaders() })
}