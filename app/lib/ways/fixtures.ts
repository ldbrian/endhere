// ============================================================
// 测试夹具 —— 验证三个观察方式的生成质量
// ------------------------------------------------------------
// good：期望的形态（应通过 validateAngle）
// bad ：必须被 validateAngle 拦下的形态（贴标签/诊断/安慰/建议/非问句/超句数）
// 用途：手工对照 + 自动化回归（verifyFixtures 一次性自检所有 bad 均被拒绝）。
// ============================================================

import type { LensId } from './lens'
import { LENSES } from './lens'
import { validateAngle } from './guard'

export interface AngleFixture {
  id: string
  fragment: string
  lensId: LensId
  good: string[]
  bad: string[]
  angleNoteHint: string
}

export const FIXTURES: AngleFixture[] = [
  {
    id: 'expectation-1',
    fragment: '最近特别烦，我感觉所有人都不理解我。',
    lensId: 'expectation',
    good: [
      '你说"所有人都不理解我"……会不会，让你难受的不是"不被理解"，而是你已经解释过很多次、却依然没有被看见？',
      '你说"我努力了却没人看见"——有没有可能，让你失落的不是这件事本身，而是它没有按你期待的方式发生？',
    ],
    bad: [
      '你太在意别人的看法了，你应该学会释怀。',
      '这说明你缺乏安全感。',
    ],
    angleNoteHint: '期望「被理解→被看见」未被满足',
  },
  {
    id: 'expectation-2',
    fragment: '老板不认可我，我做了那么多他都看不见。',
    lensId: 'expectation',
    good: [
      '你说"我做了那么多他都看不见"……会不会，让你难受的不是他不认可你，而是它没有按你期待的方式被看见？',
      '你说"做了那么多"——你有没有期待，努力本身就一定应该换来认可？',
    ],
    bad: [
      '你的期待不切实际，人不能总是要求被认可。',
      '你会越来越好的，别担心。',
    ],
    angleNoteHint: '期望「努力→认可」未被满足',
  },
  {
    id: 'time-1',
    fragment: '这件事毁了我的一天。',
    lensId: 'time',
    good: [
      '你说"这件事毁了我的一天"……如果五年后的你回看今天，会最先想起这件事的哪一部分？',
      '如果很多年以后，你只记得住今天的一小部分——你会希望记下的是什么？',
    ],
    bad: [
      '这件事早晚会过去的，别太放在心上了。',
      '你总是把事情想得太严重了。',
    ],
    angleNoteHint: '时间距离→多年后回看今天的视角',
  },
  {
    id: 'time-2',
    fragment: '我现在觉得一切都完了，这辈子可能就这样了。',
    lensId: 'time',
    good: [
      '你说"这辈子可能就这样了"……如果十年后的你回看现在，他会怎么看你今天这句话？',
      '如果时间真的能拉远，你会希望未来的你记得今天的哪一部分？',
    ],
    bad: [
      '人生还长着呢，你会有机会的。',
      '这说明你现在的状态太消极了。',
    ],
    angleNoteHint: '时间距离→十年后回看当下的判断',
  },
  {
    id: 'exception-1',
    fragment: '我一直都是这样，改不了。',
    lensId: 'exception',
    good: [
      '你说"我一直都是这样"……有没有一次同样的情况，你没有这么难受？',
      '你说"改不了"——有没有哪一次，同样的情况，你其实没有这么反应？',
    ],
    bad: [
      '你其实不是这样的人，你只是在否定自己。',
      '你并不是改不了，只是你不想改而已。',
    ],
    angleNoteHint: '例外→寻找反例',
  },
  {
    id: 'exception-2',
    fragment: '每次遇到这种情况，我第一个反应就是躲开。',
    lensId: 'exception',
    good: [
      '你说"第一个反应就是躲开"……有没有一次同样的情况，你没有躲开？那次发生了什么？',
      '你说"每次都是"——是不是也有一回，你其实没有这么做？',
    ],
    bad: [
      '这说明你缺乏勇气，应该试着面对。',
      '你总是这样逃避，你太被动了。',
    ],
    angleNoteHint: '例外→寻找"没有躲开"的那一次',
  },
]

/** 一次性自检：所有 bad 示例必须被 validateAngle 拒绝；所有 good 示例必须通过。 */
export function verifyFixtures(): { ok: boolean; failures: string[] } {
  const failures: string[] = []
  for (const fixture of FIXTURES) {
    const lens = LENSES[fixture.lensId]
    for (const good of fixture.good) {
      const check = validateAngle(lens, good)
      if (!check.ok) failures.push(`[${fixture.id}] good 被误拒: "${good}" → ${check.reason}`)
    }
    for (const bad of fixture.bad) {
      const check = validateAngle(lens, bad)
      if (check.ok) failures.push(`[${fixture.id}] bad 未被拦截: "${bad}"`)
    }
  }
  return { ok: failures.length === 0, failures }
}
