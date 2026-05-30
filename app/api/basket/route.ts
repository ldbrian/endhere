import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// =====================================================
// GET /api/basket
// 接收者：从店长投放的库中，按先入先出（FIFO）取出一件可用物品
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

    // === 核心逻辑：拉取可用物品（彻底废弃 IP 拦截） ===
    let query = supabase
      .from('iron_basket')
      .select('id, gift_id, gift_icon, gift_name, msg, created_at')
      .eq('status', 'available')
      // .neq('donor_ip', callerIp) <--- 彻底删除了这行防自领逻辑，任何人都能领！

    if (type) {
      query = query.eq('gift_id', type)
    }

    const { data, error } = await query
    if (error) throw error

    if (!data || data.length === 0) {
      return Response.json({ success: true, item: null })
    }

    // 纯内存级 24 小时绝对精度过滤（防数据库时区幽灵 Bug）
    const now = Date.now()
    const validItems = data.filter(item => {
      const createdAt = new Date(item.created_at).getTime()
      return (now - createdAt) <= 24 * 60 * 60 * 1000
    })

    if (validItems.length === 0) {
      return Response.json({ success: true, item: null })
    }

    // 先入先出 (FIFO)：按时间正序排列，最老的优先被领走
    validItems.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const targetItem = validItems[0]

    // 动态计算衰变时间文案
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
// 店长后台投放物品（彻底废弃追踪投放者 IP）
// =====================================================
// =====================================================
// POST /api/basket 
// 店长后台投放物品（加入绝对容错与字典补全机制）
// =====================================================

// 后端预设商品字典（数据清洗层）
const BASKET_DICTIONARY: Record<string, { name: string, icon: string }> = {
  milk: { name: '温牛奶', icon: '🥛' },
  ice_water: { name: '冰水', icon: '🧊' },
  candy: { name: '水果糖', icon: '🍬' },
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // 兼容多种传参格式，防止脚本写错
    const giftId = body.giftId || body.gift_id
    let giftIcon = body.giftIcon || body.gift_icon
    let giftName = body.giftName || body.gift_name
    let msg = body.msg

    if (!giftId) {
      return Response.json({ success: false, message: '必须提供物品 ID (giftId)。' }, { status: 400 })
    }

    // 核心容错：如果没传图标和名称，后端自动从字典补齐
    if (!giftIcon || !giftName) {
      const template = BASKET_DICTIONARY[giftId]
      if (template) {
        giftIcon = template.icon
        giftName = template.name
      } else {
        return Response.json({ success: false, message: '未知的物品类型，且未提供图标参数。' }, { status: 400 })
      }
    }

    // 如果店长连留言都没传，自动给一句默认兜底
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
      if (id === 'manager_coupon_special') {
        return Response.json({ success: true })
      }
      const { error } = await supabase
        .from('iron_basket')
        .update({ status: 'taken'})
        .eq('id', id)
        .eq('status', 'available') 
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