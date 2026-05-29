// app/api/basket/route.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const visitCount = parseInt(searchParams.get('visitCount') || '0', 10)
    const type = searchParams.get('type') 
    const callerIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // 店长打车券逻辑保持不变
    if (visitCount > 1 && Math.random() < 0.03) {
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
          timeLabel: null,
          isManagerCoupon: true,
          issuedAt: bjTime,
        }
      })
    }

    // 核心修复 1：拉取所有未被领取的物品，准备在内存中做绝对精度过滤
    let query = supabase
      .from('iron_basket')
      .select('id, gift_id, gift_icon, gift_name, msg, created_at') // 废弃未填写的 left_at，改用 created_at
      .eq('status', 'available')
      .neq('donor_ip', callerIp)

    if (type) query = query.eq('gift_id', type)

    const { data, error } = await query
    if (error) throw error

    if (!data || data.length === 0) return Response.json({ success: true, item: null })

    // 核心修复 2：内存级 24 小时过滤，免疫一切数据库时区 Bug
    const now = Date.now()
    const validItems = data.filter(item => {
      const createdAt = new Date(item.created_at).getTime()
      return (now - createdAt) <= 24 * 60 * 60 * 1000
    })

    if (validItems.length === 0) return Response.json({ success: true, item: null })

    // 先入先出 (FIFO)：按时间正序排列
    validItems.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const targetItem = validItems[0]

    // 修正时间文案计算
    const itemTime = new Date(targetItem.created_at).getTime()
    const hoursAgo = Math.max(1, Math.floor((now - itemTime) / (1000 * 60 * 60)))
    const timeLabel = hoursAgo >= 24 ? `${Math.floor(hoursAgo / 24)} 天前` : `${hoursAgo} 小时前`

    return Response.json({
      success: true,
      item: {
        id: targetItem.id,
        giftId: targetItem.gift_id,
        icon: targetItem.gift_icon,
        name: targetItem.gift_name,
        msg: targetItem.msg,
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