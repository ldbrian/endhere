import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// =====================================================
// GET /api/basket
// [P0 重构] 延迟让渡：必须沉淀 >24小时，随机抽取，查出即锁定
// =====================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const visitCount = parseInt(searchParams.get('visitCount') || '0', 10)
    const type = searchParams.get('type') 

    // === 店长打车券：回头客（visitCount > 1），3% 概率 ===
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

    // === 核心逻辑：拉取可用物品 ===
    let query = supabase
      .from('iron_basket')
      .select('id, gift_id, gift_icon, gift_name, msg, created_at')
      .eq('status', 'available') // 对应指令中的 unread

    if (type) {
      query = query.eq('gift_id', type)
    }

    const { data, error } = await query
    if (error) throw error

    if (!data || data.length === 0) {
      return Response.json({ success: true, item: null })
    }

    // 【P0 核心修复】：时间锁，必须在冷冰冰的铁筐里躺够 24 小时，且不超过 72 小时
    const now = Date.now()
    const validItems = data.filter(item => {
      const createdAt = new Date(item.created_at).getTime()
      const diff = now - createdAt
      return diff >= 24 * 60 * 60 * 1000 && diff <= 72 * 60 * 60 * 1000 // 24h ~ 72h 之间
    })

    if (validItems.length === 0) {
      return Response.json({ success: true, item: null })
    }

    // 【P0 核心修复】：彻底打散，纯随机抽取 1 条
    const randomIndex = Math.floor(Math.random() * validItems.length)
    const targetItem = validItems[randomIndex]

    // 【P0 核心修复】：查出即锁定。瞬间将其标记为已带走，防止并发和重复领取
    await supabase
      .from('iron_basket')
      .update({ status: 'taken' })
      .eq('id', targetItem.id)

    // 动态计算衰变时间文案（由于已经 > 24h，这里必然是以“天”为单位）
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

// =====================================================
// POST /api/basket 
// 投放物品（保持原有逻辑）
// =====================================================
const BASKET_DICTIONARY: Record<string, { name: string, icon: string }> = {
  milk: { name: '温牛奶', icon: '🥛' },
  ice_water: { name: '冰水', icon: '🧊' },
  candy: { name: '水果糖', icon: '🍬' },
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const giftId = body.giftId || body.gift_id
    let giftIcon = body.giftIcon || body.gift_icon
    let giftName = body.giftName || body.gift_name
    let msg = body.msg

    if (!giftId) {
      return Response.json({ success: false, message: '必须提供物品 ID (giftId)。' }, { status: 400 })
    }

    if (!giftIcon || !giftName) {
      const template = BASKET_DICTIONARY[giftId]
      if (template) {
        giftIcon = template.icon
        giftName = template.name
      } else {
        return Response.json({ success: false, message: '未知的物品类型，且未提供图标参数。' }, { status: 400 })
      }
    }

    if (!msg) {
      msg = '店长按今日营收，留在这里的物资。'
    }
    
    const { error } = await supabase
      .from('iron_basket')
      .insert({ 
        gift_id: giftId, 
        gift_icon: giftIcon, 
        gift_name: giftName, 
        msg: msg, 
        status: 'available' 
      })

    if (error) throw error
    return Response.json({ success: true, message: '已经放进铁筐里了。' })
  } catch (error) {
    console.error('Basket POST Error:', error)
    return Response.json({ success: false, message: '铁筐这边出了点问题。' }, { status: 500 })
  }
}

// =====================================================
// PATCH /api/basket 
// 接受（take）或放回（return）
// =====================================================
export async function PATCH(req: Request) {
  try {
    const { id, action } = await req.json()
    if (!id || !action) return Response.json({ success: false }, { status: 400 })

    if (action === 'take') {
      // GET 时已经锁定了，这里相当于只是安全确认，或者特殊物品直通
      if (id === 'manager_coupon_special') return Response.json({ success: true })
      
      await supabase.from('iron_basket').update({ status: 'taken'}).eq('id', id)
      return Response.json({ success: true })
    }

    if (action === 'return') {
      // 【补充修复】：如果用户看了但不拿，放回筐里，重置为 available 给下一个人
      const { error } = await supabase
        .from('iron_basket')
        .update({ status: 'available'})
        .eq('id', id)
      if (error) throw error
      return Response.json({ success: true })
    }

    return Response.json({ success: false }, { status: 400 })
  } catch (error) {
    console.error('Basket PATCH Error:', error)
    return Response.json({ success: false }, { status: 500 })
  }
}