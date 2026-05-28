// hooks/useBasketClaim.ts
import { useCallback } from 'react'
import { useShelterStore } from '../store/useShelterStore'

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
  const { canClaimToday, markClaimed } = useShelterStore()

  const checkBasket = useCallback(async (type?: string): Promise<BasketItem | null> => {
    try {
      // 1. 拦截网：判断今天是否已经摸过铁筐
      if (!canClaimToday()) {
        return null // 今天的善意额度已用完
      }

      // 2. 概率引擎：30% 掉落率
      const CLAIM_CHANCE = 0.3
      if (Math.random() > CLAIM_CHANCE) {
        return null
      }

      const visitCount = localStorage.getItem('endhere_visit_count') || '1'
      const url = type
        ? `/api/basket?visitCount=${visitCount}&type=${type}&t=${Date.now()}`
        : `/api/basket?visitCount=${visitCount}&t=${Date.now()}`

      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()

      if (data.success && data.item) {
        return data.item
      }

      return null
    } catch (error) {
      console.error('Basket check failed:', error)
      return null
    }
  }, [canClaimToday])

  const takeGift = useCallback(async (id: string) => {
    try {
      markClaimed() // 写入全局 Store，触发防通胀锁死
      await fetch('/api/basket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'take' })
      })
    } catch (error) {
      console.error('Take gift failed:', error)
    }
  }, [markClaimed])

  const returnGift = useCallback(async (id: string) => {
    try {
      markClaimed() // 即使归还，也算消耗了今日次数
      await fetch('/api/basket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'return' })
      })
    } catch (error) {
      console.error('Return gift failed:', error)
    }
  }, [markClaimed])

  return { checkBasket, takeGift, returnGift }
}