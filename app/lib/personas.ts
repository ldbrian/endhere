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
  // === 新增：店长的动作（虽然被拦截不走AI，但为了数据结构完整） ===
  Manager: [
    '店长点了根烟，扫了一眼你的小票...',
    '店长刚刚收车，正坐在吧台后看你的留言...',
    '店长擦了擦吧台，把你的小票压在杯子底下...',
    '店长叹了口气，什么也没说，只是接过了小票...',
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
  // === 新增：野生店长 ===
  { id: 'Manager', name: '野生店长', sub: '活人，脾气差，可留言', color: '#8c8273', locked: false }, 
]

export const PERSONA_BUTTONS: Record<string, string> = {
  Ash: '交给 Ash',
  Rin: '交给 Rin',
  Child: '交给 {name}',
  // === 新增 ===
  Manager: '把小票压在吧台',
}

export const PERSONA_PLACEHOLDERS: Record<string, string> = {
  Ash: '又怎么了？说吧，我在。',
  Rin: '说吧，我在听。不用整理，不用好看。',
  Child: '长大的世界是不是很辛苦？跟我说吧。',
  // === 新增 ===
  Manager: '小店规矩：废话少说，把想骂的、想哭的写下来，压在吧台。我半夜收车后会看。',
}