// ============================================================
// 选择逻辑（Selection Logic）—— 当前碎片如何选镜片
// ------------------------------------------------------------
// MVP：三个入口全部展示，用户自己选择（选择即档案的第一条种子）。
// 这里只决定 ①②③ 谁先出现（用户常常会选第一个，所以顺序有意义）。
// 规则级、确定性、零 LLM 成本。
// 后期：加入"档案里 landed 率高的镜片提前"的加权，MVP 不做。
// ============================================================

import type { LensId } from './lens'

export interface FragmentSignals {
  /** 时间词：适合时间镜 */
  temporal: boolean
  /** 自我固定：适合例外镜 */
  selfFixed: boolean
  /** 期待落差：适合期待镜 */
  expectation: boolean
}

export function detectSignals(fragment: string): FragmentSignals {
  const text = fragment || ''
  return {
    temporal: /一直|总是|从来|每次|这几年|从小到大|从小就|一直这样/.test(text),
    selfFixed: /我就是|我改不了|我就是这样的人|我一直都这样|我就是这样/.test(text),
    expectation: /应该|本应该|我以为|期待|以为|努力.*(没|不|却|还是)|付出.*(没|不|却)/.test(text),
  }
}

export function orderEntrances(fragment: string): LensId[] {
  const s = detectSignals(fragment)
  const order: LensId[] = ['expectation', 'time', 'exception']
  if (s.temporal) {
    order.unshift('time')
  }
  if (s.selfFixed) {
    order.unshift('exception')
  }
  // 去重（unshift 可能把同一镜片推两次）
  return order.filter((id, index, arr) => arr.indexOf(id) === index)
}
