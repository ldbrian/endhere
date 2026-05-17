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
  Sol: [
    'Sol 靠过来了，认真看着你...',
    'Sol 放下手机，专心听你说...',
    'Sol 拍了拍桌子，在想怎么说...',
    'Sol 推了推你的肩，示意你继续说...',
    'Sol 握紧了拳头，听完再说...',
  ],
}

export function getRandomAction(persona: string): string {
  const actions = PERSONA_ACTIONS[persona] || PERSONA_ACTIONS['Rin']
  return actions[Math.floor(Math.random() * actions.length)]
}

export const PERSONAS = [
  { id: 'Ash', label: 'Ash', desc: '毒舌但精准', color: 'var(--ash-color)' },
  { id: 'Rin', label: 'Rin', desc: '暖心共情', color: 'var(--rin-color)' },
  { id: 'Sol', label: 'Sol', desc: '热血打气', color: 'var(--sol-color)' },
]

export const PERSONA_BUTTONS: Record<string, string> = {
  Ash: '交给 Ash',
  Rin: '交给 Rin',
  Sol: '交给 Sol',
}

export const PERSONA_PLACEHOLDERS: Record<string, string> = {
  Ash: '又怎么了？说吧，我在。',
  Rin: '说吧，我在听。不用整理，不用好看。',
  Sol: '说！发生什么了？我在这。',
}