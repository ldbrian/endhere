// ============================================================
// 问题生成器（Question Generator）—— 生成角度，不生成答案
// ------------------------------------------------------------
// 一次应用 = 选中的镜片 + 用户原话 → 一个问句（+ 内部 angleNote）。
// 架构要点：
// - 惰性创建 OpenAI 客户端（缺配置时优雅失败，不模块级 500）
// - 低温（0.4）+ 短输出（max_tokens 300）—— 克制来自参数
// - 生成后过 validateAngle，不合格重试一次（带修正提示）
// - 只输出 JSON：{"question", "angleNote"}
// ============================================================

import OpenAI from 'openai'
import type { LensId } from './lens'
import { LENSES } from './lens'
import { validateAngle } from './guard'

export class WaysError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WaysError'
  }
}

let openaiClient: OpenAI | null = null
function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseURL = process.env.DEEPSEEK_BASE_URL
  if (!apiKey || !baseURL) return null
  openaiClient = new OpenAI({ apiKey, baseURL })
  return openaiClient
}

export interface AngleResult {
  question: string
  angleNote: string
}

function parseOutput(raw: string): { question: string; angleNote: string } | null {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed.question === 'string' && typeof parsed.angleNote === 'string') {
      return { question: parsed.question.trim(), angleNote: parsed.angleNote.trim() }
    }
  } catch {
    // 解析失败按不合格处理，触发重试
  }
  return null
}

export async function generateAngle(lensId: LensId, fragment: string): Promise<AngleResult> {
  const lens = LENSES[lensId]
  if (!lens) throw new WaysError('UNKNOWN_LENS')
  const text = (fragment || '').trim()
  if (!text) throw new WaysError('EMPTY_FRAGMENT')

  const client = getOpenAIClient()
  if (!client) throw new WaysError('LLM_NOT_CONFIGURED')

  const system = `${lens.generator.system}\n\n严格输出 JSON，仅一个对象：{"question": "给用户的话", "angleNote": "一句内部记录"}`
  let lastReason = 'GENERATION_FAILED'

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const userMessage =
      attempt === 0
        ? text
        : `${text}\n\n上次的回答不合格（原因：${lastReason}）。请重新生成：务必以问句结尾、不超过 ${lens.generator.maxSentences} 句话、不贴标签不诊断不安慰不给出建议。`

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 300,
    })

    const raw = completion.choices[0]?.message?.content || ''
    const parsed = parseOutput(raw)
    if (!parsed) {
      lastReason = 'BAD_JSON'
      continue
    }
    const check = validateAngle(lens, parsed.question)
    if (!check.ok) {
      lastReason = check.reason
      continue
    }
    return parsed
  }

  throw new WaysError(`GENERATION_FAILED:${lastReason}`)
}
