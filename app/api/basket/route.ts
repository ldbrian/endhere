import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// =====================================================
// Supabase 建表 SQL（首次部署前执行一次）:
// ... (保留你原来的 SQL 注释)
// =====================================================

// GET /api/basket?visitCount=N&type=xxx
// 接收者：按先入先出（FIFO）取出一件指定类型的可用物品（排除自己投的）
// 店长打车券：visitCount > 1 的回头客有额外 3% 概率获得（永远存在，不从 DB 取）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const visitCount = parseInt(searchParams.get('visitCount') || '0', 10)
    // 新增：允许前端指定需要的物品类型（如 'milk', 'bandaid', 'match'）
    const type = searchParams.get('type') 
    const callerIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // === 店长打车券：特殊逻辑，不存 DB，仅判断资格 ===
    // 条件：回头客（visitCount > 1），3% 概率
    if (visitCount > 1 && Math.random() < 0.03) {
      // 生成北京时间时间戳（UTC+8）
      const bjTime = new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
      return Response.json({
        success: true,
        item: {
          id: 'manager_coupon_special',
          giftId: 'manager_coupon',
          icon: '🎫',
          name: '店长的免费打车券',
          msg: '如果有幸在这个喧闹的城市中打到店长的车，店长会免费送你一程。',
          timeLabel: null, // 特殊物品不显示"X小时前"
          isManagerCoupon: true,
          issuedAt: bjTime, // 领取时间戳，用于渲染券面
        }
      })
    }

    // === 普通铁筐物品：按 FIFO (先入先出) 提取可用物品 ===
    let query = supabase
      .from('iron_basket')
      .select('id, gift_id, gift_icon, gift_name, msg, left_at')
      .eq('status', 'available')
      .neq('donor_ip', callerIp) // 防自领

    // 如果前端指定了类型，则增加过滤条件
    if (type) {
      query = query.eq('gift_id', type)
    }

    // 核心改造：按时间正序排列（最早留下的优先被领走），取第一条
    const { data, error } = await query
      .order('left_at', { ascending: true })
      .limit(1)
      .maybeSingle() // 使用 maybeSingle 避免 0 条数据时报错

    if (error) throw error

    // 如果没有找到对应的可用物品
    if (!data) {
      return Response.json({ success: true, item: null })
    }

    const leftAt = new Date(data.left_at)
    const hoursAgo = Math.max(1, Math.floor((Date.now() - leftAt.getTime()) / (1000 * 60 * 60)))
    const timeLabel = hoursAgo >= 24 ? `${Math.floor(hoursAgo / 24)} 天前` : `${hoursAgo} 小时前`

    return Response.json({
      success: true,
      item: {
        id: data.id,
        giftId: data.gift_id,
        icon: data.gift_icon,
        name: data.gift_name,
        msg: data.msg,
        timeLabel,
        isManagerCoupon: false,
      }
    })
  } catch (error) {
    console.error('Basket GET Error:', error)
    return Response.json({ success: true, item: null })
  }
}

// POST /api/basket — 赠予者放入物品
export async function POST(req: Request) {
  try {
    const { giftId, giftIcon, giftName, msg } = await req.json()
    if (!giftId || !msg) {
      return Response.json({ success: false, message: '筐里放的东西不对。' }, { status: 400 })
    }
    const donorIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { error } = await supabase
      .from('iron_basket')
      .insert({ gift_id: giftId, gift_icon: giftIcon, gift_name: giftName, msg, status: 'available', donor_ip: donorIp })
    if (error) throw error
    return Response.json({ success: true, message: '已经放进铁筐里了。' })
  } catch (error) {
    console.error('Basket POST Error:', error)
    return Response.json({ success: false, message: '铁筐这边出了点问题。' }, { status: 500 })
  }
}

// PATCH /api/basket — 接受（take）或放回（return，幂等）
export async function PATCH(req: Request) {
  try {
    const { id, action } = await req.json()
    if (!id || !action) return Response.json({ success: false }, { status: 400 })

    if (action === 'take') {
      // 店长券不存 DB，直接返回成功
      if (id === 'manager_coupon_special') {
        return Response.json({ success: true })
      }
      const { error } = await supabase
        .from('iron_basket')
        .update({ status: 'taken', taken_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'available') // 双保险：确保只认领未被拿走的
      if (error) throw error
      return Response.json({ success: true })
    }

    if (action === 'return') {
      return Response.json({ success: true })
    }

    return Response.json({ success: false }, { status: 400 })
  } catch (error) {
    console.error('Basket PATCH Error:', error)
    return Response.json({ success: false }, { status: 500 })
  }
}