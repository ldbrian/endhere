export async function extractAndSaveMemory(content: string, emotion: string, persona: string) {
  try {
    const res = await fetch('/api/extract-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, emotion }),
    })
    
    const data = await res.json()
    
    if (data.memory) {
      const memories = JSON.parse(localStorage.getItem('persona_memories') || '{}')
      // 以角色 ID 为 key，覆盖保存该角色专属的最新记忆
      memories[persona] = data.memory
      localStorage.setItem('persona_memories', JSON.stringify(memories))
    }
  } catch {
    // 提取失败不影响主流程
  }
}

export function getPersonaMemory(persona: string): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    const memories = JSON.parse(localStorage.getItem('persona_memories') || '{}')
    return memories[persona] || null
  } catch {
    return null
  }
}

export function getMemoryPromptContext(persona: string): string {
  const memory = getPersonaMemory(persona)
  if (!memory) return ''
  
  // 组装给 AI 的记忆上下文，强制要求在解析层极其自然地带出
  return `\n\n【角色专属记忆】\n用户上一次找你倾诉的核心事件是：“${memory}”。\n规则补充：请在<解析>部分，用符合你人设的口吻，自然地提一句这个记忆（例如：“上次你提到${memory}，现在又...”）。不要生硬，不要机械复述，要像熟客一样随口带出。`
}