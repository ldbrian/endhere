const MEMORY_KEY = 'end_here_customer_profile'
const DAYS_TO_FORGET = 30 * 24 * 60 * 60 * 1000 // 30天的毫秒数

export interface CustomerProfile {
  visitCount: number;         // 进店次数
  ruminateCount: number;      // 死磕次数（继续处理）
  letGoCount: number;         // 放下次数（彻底放下）
  lastVisitAt: number;        // 上次活动时间戳
  currentVibe: string;        // 吧台交接班印象（由主干聊天API顺带返回覆盖）
}

const defaultProfile: CustomerProfile = {
  visitCount: 0,
  ruminateCount: 0,
  letGoCount: 0,
  lastVisitAt: 0,
  currentVibe: "",
}

/**
 * 1. 获取空间记忆（自带 30 天物理褪色拦截器）
 */
export function getCustomerMemory(): CustomerProfile {
  if (typeof window === 'undefined') return defaultProfile

  try {
    const data = localStorage.getItem(MEMORY_KEY)
    if (!data) return defaultProfile

    const profile: CustomerProfile = JSON.parse(data)
    const now = Date.now()

    // 【遗忘机制】如果超过 30 天没来，抹除 Vibe 印象，只保留客观的进店数据
    if (profile.lastVisitAt > 0 && (now - profile.lastVisitAt > DAYS_TO_FORGET)) {
      profile.currentVibe = "" 
    }

    return profile
  } catch {
    return defaultProfile
  }
}

/**
 * 2. 记录用户的客观动作（每次触发时调用）
 */
export function recordCustomerAction(action: 'visit' | 'ruminate' | 'letGo') {
  if (typeof window === 'undefined') return

  const profile = getCustomerMemory()
  
  if (action === 'visit') profile.visitCount += 1
  if (action === 'ruminate') profile.ruminateCount += 1
  if (action === 'letGo') profile.letGoCount += 1
  
  profile.lastVisitAt = Date.now()
  
  localStorage.setItem(MEMORY_KEY, JSON.stringify(profile))
}

/**
 * 3. 覆盖交接班印象（在主聊天API返回 vibe_tag 后调用）
 */
export function updateCustomerVibe(newVibe: string) {
  if (typeof window === 'undefined' || !newVibe) return

  const profile = getCustomerMemory()
  profile.currentVibe = newVibe
  profile.lastVisitAt = Date.now()
  
  localStorage.setItem(MEMORY_KEY, JSON.stringify(profile))
}

/**
 * 4. 为大模型组装包含“动作行为”的系统提示词上下文
 */
export function getMemoryPromptContext(): string {
  const profile = getCustomerMemory()
  
  // 如果完全是新客
  if (profile.visitCount === 0 || profile.visitCount === 1) {
    return `\n\n【吧台交接班记录】\n这是新面孔。保持你的角色边界，不要过分热情。听着就行。`
  }

  // 组装熟客记录
  let context = `\n\n【吧台交接班记录（客观数据）】\n`
  context += `- 进店总数：${profile.visitCount} 次\n`
  context += `- 反刍旧账数（死磕）：${profile.ruminateCount} 次\n`
  context += `- 彻底放下数：${profile.letGoCount} 次\n`
  
  if (profile.currentVibe) {
    context += `- 上次交接班印象：“${profile.currentVibe}”\n`
  } else {
    context += `- 状态：距离上次来已经过了很久，店里对他/她的印象已经完全模糊了。\n`
  }

  context += `\n【行为洞察规则（最高禁令）】：\n请观察上述的动作数据（如反刍数与放下数的比例）。**绝不**允许使用心理学词汇（如内耗、执着、焦虑）进行说教或下诊断！你只能用符合你人设的语气，陈述你观察到的客观事实（如：“我翻了翻记录，你这张票已经掏出来看很多次了”）。`

  return context
}