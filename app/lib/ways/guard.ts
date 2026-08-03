// ============================================================
// 生成后校验（Guard）—— 让产品纪律从 prompt 恳求变成代码强制
// ------------------------------------------------------------
// 三条硬规则：
// 1. 必须是以问句结尾（给方向，不给结论）
// 2. 禁止贴标签 / 诊断 / 安慰 / 建议（见各镜片 forbidden）
// 3. 克制：不超过镜片允许的句数
// 命中任何一条 → 拒绝，触发重生成。
// ============================================================

import type { Lens } from './lens'

export type AngleValidation = { ok: true } | { ok: false; reason: string }

export function validateAngle(lens: Lens, question: string): AngleValidation {
  const text = (question || '').trim()
  if (!text) return { ok: false, reason: 'EMPTY' }

  // 只数硬句号（。！？）——"……"是停顿连接，不算一句
  const sentenceCount = (text.match(/[。！？!?]/g) || []).length
  if (lens.generator.maxSentences > 0 && sentenceCount > lens.generator.maxSentences) {
    return { ok: false, reason: `TOO_MANY_SENTENCES:${sentenceCount}` }
  }

  if (!/[？?]/.test(text)) {
    return { ok: false, reason: 'NOT_A_QUESTION' }
  }

  for (const pattern of lens.generator.forbidden) {
    if (text.includes(pattern)) {
      return { ok: false, reason: `FORBIDDEN:${pattern}` }
    }
  }

  return { ok: true }
}
