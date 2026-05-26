const MEMORY_KEY = 'end_here_customer_profile'
const DAYS_TO_FORGET = 30 * 24 * 60 * 60 * 1000 

export interface CustomerProfile {
  visitCount: number;         
  ruminateCount: number;      
  letGoCount: number;         
  lastVisitAt: number;        
  currentVibe: string;        
}

const defaultProfile: CustomerProfile = {
  visitCount: 0,
  ruminateCount: 0,
  letGoCount: 0,
  lastVisitAt: 0,
  currentVibe: "",
}

export function getCustomerMemory(): CustomerProfile {
  if (typeof window === 'undefined') return defaultProfile

  try {
    const data = localStorage.getItem(MEMORY_KEY)
    if (!data) return defaultProfile

    const profile: CustomerProfile = JSON.parse(data)
    const now = Date.now()

    if (profile.lastVisitAt > 0 && (now - profile.lastVisitAt > DAYS_TO_FORGET)) {
      profile.currentVibe = "" 
    }
    return profile
  } catch {
    return defaultProfile
  }
}

export function recordCustomerAction(action: 'visit' | 'ruminate' | 'letGo') {
  if (typeof window === 'undefined') return

  const profile = getCustomerMemory()
  
  if (action === 'visit') profile.visitCount += 1
  if (action === 'ruminate') profile.ruminateCount += 1
  if (action === 'letGo') profile.letGoCount += 1
  
  profile.lastVisitAt = Date.now()
  localStorage.setItem(MEMORY_KEY, JSON.stringify(profile))
}

export function updateCustomerVibe(newVibe: string) {
  if (typeof window === 'undefined' || !newVibe) return

  const profile = getCustomerMemory()
  profile.currentVibe = newVibe
  profile.lastVisitAt = Date.now()
  
  localStorage.setItem(MEMORY_KEY, JSON.stringify(profile))
}

export function getMemoryPromptContext(): string {
  const profile = getCustomerMemory()
  let context = ""

  // 1. 组装熟客行为记录
  if (profile.visitCount === 0 || profile.visitCount === 1) {
    context = `\n\n【吧台交接班记录】\n这是新面孔。保持你的角色边界，不要过分热情。听着就行。`
  } else {
    context = `\n\n【吧台交接班记录（客观数据）】\n`
    context += `- 进店总数：${profile.visitCount} 次\n`
    context += `- 反刍旧账数（死磕）：${profile.ruminateCount} 次\n`
    context += `- 彻底放下数：${profile.letGoCount} 次\n`
    
    if (profile.currentVibe) {
      context += `- 上次交接班印象：“${profile.currentVibe}”\n`
    } else {
      context += `- 状态：距离上次来已经过了很久，店里对他/她的印象已经完全模糊了。\n`
    }

    context += `\n【行为洞察规则（最高禁令）】：\n请观察上述的动作数据。绝不允许使用心理学词汇（如内耗、执着、焦虑）进行说教或下诊断！你只能陈述客观事实。`
  }

  // === 2. 核心新增：守门人拦截系统（提取创可贴禁区） ===
  if (typeof window !== 'undefined') {
    try {
      const entriesStr = localStorage.getItem('entries')
      if (entriesStr) {
        const entries = JSON.parse(entriesStr)
        // 筛选出正在被创可贴封印的事件
        const sealedEvents = entries.filter((e: any) => e.isSealed && e.sealedUntil && Date.now() < e.sealedUntil)
        
        if (sealedEvents.length > 0) {
          context += `\n\n【🚨 系统最高警告：绝对禁区（守门人模式）】\n该用户已在物理层面上，使用“创可贴”强行封印了以下事件（截取）：\n`
          sealedEvents.forEach((e: any) => {
            // 提取前30个字作为事件指纹
            context += `- 封印中："${e.content.substring(0, 30)}..."\n`
          })
          context += `\n如果用户在本次对话中试图绕过封印，重新提起或反刍上述“封印中”的具体旧事，你必须立刻启动‘守门人模式’！\n`
          context += `绝对拒绝展开讨论，不提供任何分析。你只能用当前的角色语气告诉他类似这样的话：“这个伤口已经贴上创可贴了，说好暂时不碰它的，去聊点别的吧。”`
        }
      }
    } catch (e) {
      console.error('Failed to parse entries for gatekeeper', e)
    }
  }

  return context
}