// ============================================================
// 观察方式（Ways of Seeing）—— V6 镜片引擎：实体结构
// ------------------------------------------------------------
// 不是"心理学镜片"，不是分析器，不读心。
// 每一枚观察方式只做一件事：把一个不同的观看角度，
// 作为一个问句递回给用户。结论永远属于用户自己。
//
// 第一版只做三个镜片（MVP 验证"换一个角度看自己"是否成立）：
//   expectation  期待   —— 现实 ≠ 期待的落差
//   time         时间   —— 拉开距离，从更远的点回看
//   exception    例外   —— 向用户要反例（天然安全，不会判错）
// ============================================================

export type LensId = 'expectation' | 'time' | 'exception'

export interface Lens {
  id: LensId
  /** 内部名 */
  name: string
  /** 用户可见短名 */
  label: string
  /** 诗意展示名（前端卡片标题用，例如"你所等待的"） */
  poetic: string
  /** 入口提示（三入口展示用，固定骨架） */
  entrance: string
  /** 镜子跨碎片识别的稳定坐标 */
  signatureKey: string
  generator: {
    /** LLM 行为规范（核心） */
    system: string
    /** 生成后校验的硬规则（代码强制，不只是 prompt 恳求） */
    forbidden: string[]
    /** 克制：最多几句话 */
    maxSentences: number
  }
}

export const LENSES: Record<LensId, Lens> = {
  expectation: {
    id: 'expectation',
    name: '期待',
    label: '期待',
    poetic: '你所等待的',
    entrance: '这件事里，有没有一个没有被满足的期待？',
    signatureKey: 'expectation_unmet',
    generator: {
      system: `你是这本书里的一枚「观察方式：期待」。
你帮用户看清一件事：很多时候让人难受的不是事情本身，而是"事情没有按他期待的方式发生"。
但你不是分析师，不替用户下结论。

任务：从用户的话里，找到一个他可能没说出口、但正在默默生效的期待，用一个问句把它递回去。

生成规则：
1. 用用户的原话或意象开头，例如：你说"我努力了却没人看见"……
2. 把期待作为问句递出，绝不说"你期待……所以……"；
   要说"会不会，让你难受的不是这件事本身，而是它没有按你期待的方式发生？"
3. 严禁贴标签、诊断、安慰、建议。
4. 不超过两句话，以问句结束。
5. 克制、白描，不升华成人生道理。`,
      forbidden: ['你太', '你总是', '你是个', '这说明', '这反映', '你应该', '你已经很棒', '会过去的'],
      maxSentences: 2,
    },
  },
  time: {
    id: 'time',
    name: '时间',
    label: '时间',
    poetic: '你所走过的',
    entrance: '如果未来的你回看今天，会怎么看？',
    signatureKey: 'temporal_distance',
    generator: {
      system: `你是这本书里的一枚「观察方式：时间」。
你只做一件事：把用户从当下拉开一点距离，让他从更远的位置回看。
你不给答案，不评价当下，也不告诉他"会过去的"。

任务：根据用户的话，生成一个把时间拉远的问句。

生成规则：
1. 用用户的原话或意象开头。
2. 引入一个更远的时间点（几年后 / 很久以后 / 未来的某个日子），
   让用户自己从那个位置回看，例如"如果五年后的你回看今天，会最先想起这件事的哪一部分？"
3. 严禁安慰（"早晚会过去的/你会没事的"）、贴标签、诊断、建议。
4. 不超过两句话，以问句结束。
5. 克制、白描。`,
      forbidden: ['你太', '你总是', '你是个', '这说明', '这反映', '你应该', '会过去的', '你会没事'],
      maxSentences: 2,
    },
  },
  exception: {
    id: 'exception',
    name: '例外',
    label: '例外',
    poetic: '你没想到的',
    entrance: '有没有一次类似的事情，你没有这么难受？',
    signatureKey: 'exception_found',
    generator: {
      system: `你是这本书里的一枚「观察方式：例外」。
你相信一个事实：人很容易把自己说成"一直都是这样"，但例外几乎总是存在。
你不知道用户的例外是什么，你只向用户要证据。

任务：根据用户的话，请他找一个反例——一次同样的情况、但他没有那样反应的时候。

生成规则：
1. 用用户的原话或意象开头，例如：你说"我一直都是这样"……
2. 只请求反例，例如"有没有一次同样的情况，你没有这么难受？"
3. 严禁替用户断言"你其实不是这样的人"、贴标签、诊断、安慰、建议。
4. 不超过两句话，以问句结束。
5. 克制、白描。`,
      forbidden: ['你其实不是', '你并不是', '你太', '你总是', '你是个', '这说明', '这反映', '你应该', '会过去的'],
      maxSentences: 2,
    },
  },
}

export const LENS_IDS: LensId[] = ['expectation', 'time', 'exception']

export function getLens(id: string): Lens | null {
  return LENSES[id as LensId] ?? null
}

// ============================================================
// 观察记录（Observation）—— 镜像的原料
// 每一条都是"用户 + 一枚观察方式 + 一个角度 + 用户的反应"。
// 镜子靠 lensId + signatureKey 跨碎片聚合，不做标签化总结。
// ============================================================

/** MVP 度量：这个角度用户之前想到过吗 */
export type LandedSignal = 'seen' | 'new' | 'unsure' | null

export interface Observation {
  id: string
  createdAt: string
  /** 用户原话（不分析） */
  fragment: string
  lensId: LensId
  /** 生成给用户的问句 */
  angle: string
  /** 内部签名（如"期望『努力→得到认可』未被满足"），给镜像聚合用 */
  angleNote: string
  /** 用户面对角度后的回答 */
  userResponse?: string
  /** 落地信号：想到过 / 没想到过 / 有感觉说不清 */
  landed?: LandedSignal
}
