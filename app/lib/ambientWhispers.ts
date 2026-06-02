import { TimeSlice } from './time';

export const AMBIENT_WHISPERS: Record<TimeSlice, string[]> = {
  DEEP_NIGHT: [
    '水壶在阴影里发出细微的沸腾声。',
    '吧台深处传来木头轻微爆裂的脆响。',
    '安静得能听见自己心跳的错觉。'
  ],
  DAWN: [
    '门外的晨雾让玻璃蒙上了一层水汽。',
    '收银台后面的纸箱传来极其轻微的挪动声。'
  ],
  DAYTIME: [
    '窗外有一辆车隆隆驶过。',
    '阳光里的灰尘在光柱里缓慢浮动。'
  ],
  DUSK_TO_MIDNIGHT: [
    '头顶的灯管微微闪烁，发出嗞嗞的电流声。',
    '门外的风把铁皮招牌吹得嘎吱响了一声。'
  ]
};