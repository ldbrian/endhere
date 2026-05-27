import { useCallback } from 'react'

export interface BasketItem {
  id: string
  giftId: string
  icon: string
  name: string
  msg: string
  timeLabel: string | null
  isManagerCoupon: boolean
  issuedAt?: string
}

export function useBasketClaim() {
  // 获取今天的本地日期字符串（时区对齐北京时间，用于防刷）
  const getTodayStr = () => {
    return new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
  }

  // 核心拦截逻辑：检查是否有缘分遇到物品
  const checkBasket = useCallback(async (type?: string): Promise<BasketItem | null> => {
    try {
      // 1. 本地防刷检查：一天只打扰一次
      const lastClaimed = localStorage.getItem('endhere_last_claimed_date')
      if (lastClaimed === getTodayStr()) {
        return null // 今天已经触发过拦截了，保持安静
      }

      // 2. 命运掷骰子：30% 概率触发 (如果你今天想自己测试，可以暂时改成 1.0 必中)
      // 【测试专用】确保每次都必定触发拦截，测完记得改回 0.3！
      const CLAIM_CHANCE = 0.3 
      if (Math.random() > CLAIM_CHANCE) {
        return null 
      }

      const visitCount = localStorage.getItem('endhere_visit_count') || '1'
      // 【核心修改】在 URL 后面加一个时间戳 &t=...，彻底击穿浏览器缓存！
      const url = type 
        ? `/api/basket?visitCount=${visitCount}&type=${type}&t=${Date.now()}`
        : `/api/basket?visitCount=${visitCount}&t=${Date.now()}`
        
      const res = await fetch(url, { cache: 'no-store' }) // 双重防缓存保险
      const data = await res.json()

      if (data.success && data.item) {
        return data.item
      }
      
      return null
    } catch (error) {
      console.error('Basket check failed:', error)
      return null
    }
  }, [])

  // 用户点击“收下”
  const takeGift = useCallback(async (id: string) => {
    try {
      // 标记今天已领取，防止刷新页面反复刷
      localStorage.setItem('endhere_last_claimed_date', getTodayStr())
      
      await fetch('/api/basket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'take' })
      })
    } catch (error) {
      console.error('Take gift failed:', error)
    }
  }, [])

  // 用户点击“留给下一个人”
  const returnGift = useCallback(async (id: string) => {
    try {
      // 即便放回，也算今天产生过交集了，不再弹窗打扰
      localStorage.setItem('endhere_last_claimed_date', getTodayStr())
      
      await fetch('/api/basket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'return' })
      })
    } catch (error) {
      console.error('Return gift failed:', error)
    }
  }, [])

  return { checkBasket, takeGift, returnGift }
}