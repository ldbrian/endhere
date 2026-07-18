export const SHOPKEEPER_REPLY_READ_AT_KEY = 'endhere_v2_shopkeeper_reply_read_at';

export type ShopkeeperReplyRecord = {
  shopkeeper_comment: string | null;
  updated_at: string | null;
};

function toTime(value: string | null | undefined) {
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getLatestShopkeeperReplyAt(records: ShopkeeperReplyRecord[]) {
  const latestTime = records.reduce((latest, record) => {
    if (!record.shopkeeper_comment?.trim()) return latest;
    return Math.max(latest, toTime(record.updated_at));
  }, 0);

  return latestTime > 0 ? new Date(latestTime).toISOString() : null;
}

export function getReadShopkeeperReplyAt() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SHOPKEEPER_REPLY_READ_AT_KEY);
}

export function hasUnreadShopkeeperReply(latestReplyAt: string | null, readAt: string | null) {
  return toTime(latestReplyAt) > toTime(readAt);
}

export function markShopkeeperRepliesRead(latestReplyAt: string | null) {
  if (typeof window === 'undefined' || !latestReplyAt) return;
  window.localStorage.setItem(SHOPKEEPER_REPLY_READ_AT_KEY, latestReplyAt);
}
