import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAILY_MANAGER_LIMIT = 7

export async function POST(req: Request) {
  try {
    const { receiptId, userMessage, aiResponse } = await req.json()
    
    // ==========================================
    // [CTO 注入] 增强型上帝控制台 (CLI)
    // ==========================================
    const cmd = userMessage.trim().toLowerCase()
    
    // 只要是 "/" 开头，强制视为系统指令，绝对不进入下方正常留言逻辑
    if (cmd.startsWith('/')) {
      let eventType = null
      
      // 容错匹配：包含关键词即可
      if (cmd.includes('rain')) eventType = 'rain'
      else if (cmd.includes('bulb') || cmd.includes('broken')) eventType = 'broken_bulb'
      else if (cmd.includes('clear')) eventType = 'clear'

      if (eventType) {
        // 瞬间篡改全局物理状态
        const { error: updateError } = await supabase
          .from('world_state')
          .update({ event_type: eventType, updated_at: new Date().toISOString() })
          .eq('id', true)

        if (updateError) throw updateError

        return Response.json({ 
          success: true, 
          message: `[System] 物理法则已覆写: ${eventType.toUpperCase()}` 
        })
      } else {
        // 指令拼写错误，给出明确反馈，而非存入数据库
        return Response.json({ 
          success: false, 
          message: `[System] 未知指令，可用: /rain, /bulb, /clear` 
        })
      }
    }
    // ==========================================

    // 常规店长留言逻辑 (防通胀拦截)
    const today = new Date().toISOString().split('T')[0]
    const { count, error: countError } = await supabase
      .from('manager_mailbox')
      .select('*', { count: 'exact', head: true })
      .eq('created_date', today)

    if (countError) throw countError

    if (count !== null && count >= DAILY_MANAGER_LIMIT) {
      return Response.json({ success: false, message: '今天太累了，吧台已经塞满了。' })
    }

    const { error: insertError } = await supabase
      .from('manager_mailbox')
      .insert({
        receipt_id: receiptId,
        user_message: userMessage,
        ai_response: aiResponse,
        created_date: today
      })

    if (insertError) {
      if (insertError.code === '23505') {
        return Response.json({ success: false, message: '这张票已经处理过了。' })
      }
      throw insertError
    }

    return Response.json({ success: true, message: '妥投。' })
  } catch (error) {
    console.error('Mailbox POST Error:', error)
    return Response.json({ success: false, message: '系统故障' }, { status: 500 })
  }
}

// GET 方法保持不变...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const receiptId = searchParams.get('receiptId')
    if (!receiptId) return Response.json({ success: false, data: null })

    const { data, error } = await supabase
      .from('manager_mailbox')
      .select('manager_reply')
      .eq('receipt_id', receiptId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return Response.json({ success: true, reply: data?.manager_reply || null })
  } catch (error) {
    console.error('Mailbox GET Error:', error)
    return Response.json({ success: false, reply: null })
  }
}