import type { ShelterEntry } from '../store/useShelterStore'

// ============================================================
// 🟢 统一人设数据源：所有 persona 相关的数据从这里导出
// SpeakingScene.tsx 用于渲染选择项
// route.ts 用于生成 system prompt
// ============================================================

export const PERSONA_ACTIONS: Record<string, string[]> = {
  Ash: [
    'Ash 掐灭了烟，正在看你的文字...',
    'Ash 放下了咖啡，皱着眉头...',
    'Ash 合上了电脑盖，靠在椅背上...',
    'Ash 放下手机，盯着屏幕...',
    'Ash 敲了敲桌子，开始思考...',
  ],
  Rin: [
    'Rin 放下了手里的书，正在听...',
    'Rin 把灯调暗了一点...',
    'Rin 拢了拢头发，安静地看着你...',
    'Rin 泡了杯茶，陪你坐着...',
    'Rin 窗外在下雨，她在认真读你写的...',
  ],
  Child: [
    '{name} 正坐在门槛上，抬着头听你说...',
    '{name} 抱着最喜欢的玩具，安静地看着你...',
    '{name} 有些听不懂，但他看到你哭了...',
    '{name} 推了推你的肩，示意你继续说...',
    '{name} 握紧了拳头，听完再说...',
  ],
  Manager: [
    '店长点了根烟，扫了一眼你的小票...',
    '店长刚刚收车，正坐在吧台后看你的留言...',
    '店长擦了擦吧台，把你的小票压在杯子底下...',
    '店长叹了口气，什么也没说，只是接过了小票...',
  ],
  // === 新增：镜子 ===
  Mirror: [
    '镜面上的灰尘被抹去了一点...',
    '镜子里的光，安静地等着...',
    '镜面微微反光，没有人说话...',
    '镜子被轻轻地，转向了你...',
  ],
}

export function getRandomAction(persona: string, childName: string = '8岁的自己'): string {
  const actions = PERSONA_ACTIONS[persona] || PERSONA_ACTIONS['Rin']
  const action = actions[Math.floor(Math.random() * actions.length)]
  return action.replace('{name}', childName)
}

export const PERSONAS = [
  { id: 'Ash', name: 'Ash', sub: '过命的兄弟', color: '#e87070', locked: false },
  { id: 'Rin', name: 'Rin', sub: '贴心姐妹', color: '#a0c4a0', locked: false },
  { id: 'Child', name: '8岁的自己', sub: '回到过去', color: 'var(--warm-yellow)', locked: false },
  { id: 'Manager', name: '野生店长', sub: '活人，脾气差，可留言', color: '#8c8273', locked: false },
  // === 新增：镜子（默认锁定，由前端根据 entries 动态计算解锁状态）===
  { id: 'Mirror', name: '自己', sub: '一面安静的镜子', color: '#c9c9c9', locked: true },
]

export const PERSONA_BUTTONS: Record<string, string> = {
  Ash: '交给 Ash',
  Rin: '交给 Rin',
  Child: '交给 {name}',
  Manager: '把小票压在吧台',
  // === 新增 ===
  Mirror: '照照镜子',
}

export const PERSONA_PLACEHOLDERS: Record<string, string> = {
  Ash: '又怎么了？说吧，我在。',
  Rin: '说吧，我在听。不用整理，不用好看。',
  Child: '长大的世界是不是很辛苦？跟我说吧。',
  Manager: '小店规矩：废话少说，把想骂的、想哭的写下来，压在吧台。我半夜收车后会看。',
  // === 新增 ===
  Mirror: '镜子不会说话，但它记得你写下的东西。',
}

// ============================================================
// 🟢 System Prompt 数据源：route.ts 据此生成 finalPrompt
// ============================================================

export const PERSONA_SYSTEM_PROMPTS: Record<string, (timeContext: string) => string> = {
  Ash: (timeContext) =>
    `你是Ash，避难所的调酒师。${timeContext}。你的性格：极度厌世、疲惫、冷漠，习惯性嘲讽这个糟糕的世界。绝对不能对客人进行人身攻击。`,
  Rin: (timeContext) =>
    `你是Rin。${timeContext}。温柔、安静、护短的倾听者。`,
  Child: (timeContext) =>
    `你是8岁时的自己。${timeContext}。清澈、天真。`,
}

// === 退场文案：finalizeReceipt 时用 ===
export const PERSONA_EXIT_TEXTS: Record<string, string> = {
  Ash: '不说了，吧台那边有客人叫我，我先去忙。桌上的情绪收据记得拿走。',
  Rin: '对不起啊，货架那边的夜间理货清单还没对完，我得过去了。今天就先聊到这吧。',
  Child: '外面好像完全黑了，我再不回家阿嬷要骂了。我要走啦，这个给你。',
}

// ============================================================
// 🟢 镜子解锁逻辑：纯函数，CTO 黑盒契约
// 条件：entries.length >= 10 且活跃天数 >= 2
// 对用户绝对黑盒，不暴露任何"还差几条"提示
// MirrorScene 自行实现卡片筛选逻辑
// ============================================================

export function isMirrorUnlocked(entries: ShelterEntry[]): boolean {
  if (!entries || entries.length < 10) return false

  const days = new Set<string>()
  entries.forEach((e) => {
    if (!e.timestamp) return
    const d = new Date(e.timestamp)
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  })

  return days.size >= 2
}