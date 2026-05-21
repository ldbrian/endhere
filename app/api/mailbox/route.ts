import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAILY_MANAGER_LIMIT = 7

// 处理用户压小票（投递）
// 处理用户压小票（投递）
export async function POST(req: Request) {
  try {
    // 增加接收 aiResponse
    const { receiptId, userMessage, aiResponse } = await req.json()
    const today = new Date().toISOString().split('T')[0]

    // 1. 检查今天店长接了多少单了
    const { count, error: countError } = await supabase
      .from('manager_mailbox')
      .select('*', { count: 'exact', head: true })
      .eq('created_date', today)

    if (countError) throw countError

    // 2. 触发防爆机制
    if (count !== null && count >= DAILY_MANAGER_LIMIT) {
      return Response.json({ success: false, message: '今晚吧台压的小票满了，店长已经收车去睡了。' })
    }

    // 3. 存入抽屉（带上 AI 的回复内容）
    const { error: insertError } = await supabase
      .from('manager_mailbox')
      .insert({
        receipt_id: receiptId,
        user_message: userMessage,
        ai_response: aiResponse, // 写入新字段
        created_date: today
      })

    if (insertError) {
      if (insertError.code === '23505') {
        return Response.json({ success: false, message: '这张小票已经压在吧台了。' })
      }
      throw insertError
    }

    return Response.json({ success: true, message: '小票已压在吧台，店长下班会看。' })
  } catch (error) {
    console.error('Mailbox POST Error:', error)
    return Response.json({ success: false, message: '吧台抽屉卡住了，请稍后再试。' }, { status: 500 })
  }
}

// 处理用户凭小票暗号取回信（查询）
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