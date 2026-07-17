// Book Voice —— 书自己的嗓音。
// 与 Persona（回应这一页）、Mirror（照见你）平行的第三声：书在认识你。
//
// MVP 只做纯情绪支：句子不含任何名词/坐标，零证据需求，不可能说错。
// 遵守 Book Voice 语言协议 v0.1：
//   1. 只第一人称（主语永远是「我/书」，「你」只能作宾语）
//   2. 禁问句（不用 吗/呢/为什么/？）
//   3. 禁判断词（不命名用户内心：孤独/害怕/累/…）
//   4. 禁比较（不用 更/最/总是/很少/越来越）

export type BookVoiceId = string;
export type BookVoice = { id: BookVoiceId; text: string };

export const BOOK_VOICES: BookVoice[] = [
  { id: 'glad_to_see_you', text: '今天，又见到你了。' },
  { id: 'nothing_to_write', text: '今天什么都不用写。\n翻开看看，也很好。' },
  { id: 'curious', text: '我有一点点好奇。\n这一页会写下什么。' },
  { id: 'waiting', text: '我在这里。\n不急。' },
  { id: 'remember', text: '有些页，我记得。' },
  { id: 'quiet_today', text: '今天没什么想说的。\n只是想待一会儿。' },
  { id: 'wonder_unwritten', text: '我好奇，\n下一页会是什么样。' },
  { id: 'uncertain', text: '我说不清。\n但今天，我想认识你多一点。' },
];

// 15% 概率走 Book Voice（常量，可调）。稀有本身就是效果。
const BOOK_VOICE_RATE = 0.15;

// 决定本页显示什么。返回 null 表示走原 Window prompt。
export function pickBookVoice(): BookVoice | null {
  if (Math.random() >= BOOK_VOICE_RATE) return null;
  return BOOK_VOICES[Math.floor(Math.random() * BOOK_VOICES.length)];
}
