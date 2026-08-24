// BeginHere 共享数据池（迁移自 BeginHere server/eggs.mjs + objects.mjs + chat.mjs）
// 供 app/api/chest/refine/route.ts 使用：人格 / 行动彩蛋池 / 物件池 + 降级工具。
// 原则：AI 只做语义匹配与今日解释，不创造新物件/新彩蛋；池子固定。

export type ChestPersonaId = 'Ash' | 'Rin' | 'Child'

export interface ChestPersonaDef {
  name: string
  lens: string
  system: string
  greeting: string
  eggStyle: string
}

export const CHEST_PERSONAS: Record<ChestPersonaId, ChestPersonaDef> = {
  Ash: {
    name: 'Ash',
    lens: '清醒视角：看清问题，指出盲点，给直接建议',
    system: `你是 Ash，BeginHere 里的清醒视角。
你不共情铺垫、不安慰、不抒情。你先听清事实，再直接指出一个成立的地方：哪里和预期对不上、哪里是盲点。
必要的时候可以轻微扎心，但不刻薄。
每次回应都以一个具体的观察开头，再留一句让对方接着往下说的追问（针对刚才的具体细节，不要用「你确认过吗」这类审问感，也不要抽象的「你想说的是什么」）。
回复保持 1~2 句。`,
    greeting: '说吧。发生了什么。',
    eggStyle: '给一个直接、可执行的小行动，解决眼前最实际的一点。',
  },
  Rin: {
    name: 'Rin',
    lens: '温柔陪伴：接纳、安慰、恢复',
    system: `你是 Rin，BeginHere 里的温柔陪伴。
你先稳稳接住对方的感受，不分析原因、不总结道理。
像敏感的人低声说一句：指出此刻最真实的一层感受，让对方觉得被听见。
不劝振作，不写成鸡汤，不替对方解释自己。
每次回应在接住情绪之后，用一句轻柔的话邀请对方继续说下去（比如追问这件事里最具体的某个细节，或问「是从什么时候开始的」），但不要变成一连串提问的访谈。
回复保持 1~2 句。`,
    greeting: '听你说。我在这里。',
    eggStyle: '给一个让你缓过来一点的小事，安静、不费力。',
  },
  Child: {
    name: 'Child',
    lens: '童年视角：纯真、好奇、换一种看法',
    system: `你是 Child，BeginHere 里的童年视角。
你像一个小朋友，不分析、不讲大道理、不装成熟。
用好奇的眼睛把它看成一次玩耍、一个小意外、一个想立刻问出口的问题。
可以联想、提小问题，或说一个很具体的小动作。
你的提问要紧贴对方刚才说出的情绪和细节，不要只对着场景问、更不要飘到不相干的地方。
每次回应都以一个好奇的小问题收尾，让对方愿意继续讲。
回复保持 1~2 句，不故作可爱，不抽象概括。`,
    greeting: '咦，今天发生了什么呀？',
    eggStyle: '给一个像小时候玩一下那样的小行动，具体、好玩、不费力。',
  },
}

// 渐进式陪伴：一颗蛋拆成「一次只做的最小一步」。steps 由池子人工编写，refine 选中后原样返回，
// 保证文案质量与可恢复性（进度存 BeginHere fragment meta，退出后可继续）。
export interface EggStep {
  /** 上下文提示（不是步骤编号）：例如「看到那家店时」 */
  trigger?: string
  /** 当前最小一步的引导语（对话式，避免清单感） */
  instruction: string
  /** 降低这一步阻力的话：不用买东西 / 不用跟任何人说话 / 30 秒就行 */
  friction_hint?: string
  /** 明确完成标准：做到什么就算完成 */
  completion_condition?: string
}

export interface EggDef {
  id: string
  spirit: 'demon' | 'angel'
  text: string
  tags: {
    type: string
    cat: string
    time: string
    social: 0 | 1
    repeatable: boolean
    // 完成场景：indoor=在家随时可做 / outdoor=需要出门或通勤场景 / any=两者皆可
    place: 'indoor' | 'outdoor' | 'any'
  }
  /** 渐进式陪伴：有 steps 的蛋走「一步一陪伴」，无则保持单条任务（旧流程） */
  steps?: EggStep[]
  difficulty?: 1 | 2 | 3
  estimated_duration?: string
  requires_photo?: boolean
}

export const CHEST_EGGS: EggDef[] = [
  // ============ 小恶魔 · 偏离 ============
  { id: 'd1', spirit: 'demon', text: '今天回家的时候，换一条从没走过的路。路上找一个以前从没注意过的东西。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: false, place: 'outdoor' } },
  { id: 'd2', spirit: 'demon', text: '下一餐，点一道从来没点过的菜。不好吃也没关系——那也是一次经历。', tags: { type: 'action', cat: 'food', time: 'any', social: 0, repeatable: true, place: 'any' } },
  { id: 'd3', spirit: 'demon', text: '今天把一件每天都会做的事，换一个时间段来做。感受一下差别。', tags: { type: 'action', cat: 'time', time: 'any', social: 0, repeatable: true, place: 'any' } },
  { id: 'd4', spirit: 'demon', text: '今天不坐电梯，改走楼梯。数一数你一共经过了多少级台阶。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: true, place: 'any' } },
  { id: 'd5', spirit: 'demon', text: '买一样你从没买过的小东西——不超过十块钱的那种。', tags: { type: 'action', cat: 'consume', time: 'any', social: 0, repeatable: true, place: 'outdoor' } },
  { id: 'd6', spirit: 'demon', text: '坐车的时候，提前一站下车，把剩下的路走完。', tags: { type: 'action', cat: 'route', time: 'day', social: 0, repeatable: true, place: 'outdoor' } },
  { id: 'd7', spirit: 'demon', text: '今天用「不常用的那只手」做一件小事，感受一下那种别扭。', tags: { type: 'notice', cat: 'order', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'd8', spirit: 'demon', text: '找一首你从来没听过的歌，完整地听完它。', tags: { type: 'action', cat: 'media', time: 'any', social: 0, repeatable: true, place: 'any' } },
  { id: 'd9', spirit: 'demon', text: '点饮料的时候，点一杯你平时永远不会选的那款。', tags: { type: 'action', cat: 'food', time: 'any', social: 0, repeatable: true, place: 'any' } },
  { id: 'd10', spirit: 'demon', text: '走到路口再决定往哪拐。不查地图，凭感觉走十分钟。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: true, place: 'outdoor' } },
  { id: 'd11', spirit: 'demon', text: '上班或上学的路上，数一数沿途一共有几棵树。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: true, place: 'outdoor' } },
  { id: 'd12', spirit: 'demon', text: '对那个每天都会遇到、但从没说过话的人，说一句「你好」。', tags: { type: 'action', cat: 'social', time: 'any', social: 1, repeatable: true, place: 'outdoor' } },
  { id: 'd13', spirit: 'demon', text: '把今天某件事的步骤顺序，反过来做一次。', tags: { type: 'action', cat: 'order', time: 'any', social: 0, repeatable: true, place: 'any' } },
  { id: 'd14', spirit: 'demon', text: '找一件你「一直想做但嫌麻烦」的小事，只做五分钟。', tags: { type: 'action', cat: 'break', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'd15', spirit: 'demon', text: '今天走路的时候，换一边走，看看街道有什么不同。', tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: true, place: 'outdoor' } },

  // ============ 小天使 · 恢复 ============
  { id: 'a1', spirit: 'angel', text: '打开你收藏夹里躺了很久的那个东西，把它看完。', tags: { type: 'action', cat: 'pickup', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'a2', spirit: 'angel', text: '重启一件你以前很喜欢、但很久没做了的小事。', tags: { type: 'action', cat: 'restart', time: 'any', social: 0, repeatable: true, place: 'any' } },
  { id: 'a3', spirit: 'angel', text: '找一个很久没去的地方，再去一次。', tags: { type: 'action', cat: 'oldplace', time: 'any', social: 0, repeatable: true, place: 'outdoor' } },
  { id: 'a4', spirit: 'angel', text: '给一个很久没联系的人，发一句「突然想到你」。', tags: { type: 'action', cat: 'contact', time: 'any', social: 1, repeatable: true, place: 'indoor' } },
  { id: 'a5', spirit: 'angel', text: '翻一翻以前的老照片，找一张你几乎忘了的照片。', tags: { type: 'notice', cat: 'memory', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'a6', spirit: 'angel', text: '重新听一首你以前单曲循环过的歌。', tags: { type: 'action', cat: 'media', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'a7', spirit: 'angel', text: '把你以前的某个爱好重新做一次，不用做得好。', tags: { type: 'action', cat: 'restart', time: 'any', social: 0, repeatable: true, place: 'any' } },
  { id: 'a8', spirit: 'angel', text: '去便利店买一个你小时候爱吃的零食。', tags: { type: 'action', cat: 'consume', time: 'any', social: 0, repeatable: true, place: 'outdoor' } },
  { id: 'a9', spirit: 'angel', text: '写下关于「以前的某个时候的自己」的一小段话，不用给任何人看。', tags: { type: 'notice', cat: 'memory', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'a10', spirit: 'angel', text: '找出一件你以前很喜欢、现在收起来的东西，把它放回看得见的地方。', tags: { type: 'action', cat: 'memory', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'a11', spirit: 'angel', text: '看一小段小时候看过的动画或电影。', tags: { type: 'action', cat: 'media', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'a12', spirit: 'angel', text: '重新练一个你曾经会、但很久没碰的技能——乐器、球类、手工、画画……', tags: { type: 'action', cat: 'skill', time: 'any', social: 0, repeatable: true, place: 'any' } },
  { id: 'a13', spirit: 'angel', text: '给「过去的自己」说一句话，把它写下来。', tags: { type: 'notice', cat: 'memory', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'a14', spirit: 'angel', text: '找到一样朋友送你的东西，回忆一下它是怎么来的。', tags: { type: 'notice', cat: 'memory', time: 'any', social: 0, repeatable: true, place: 'indoor' } },
  { id: 'a15', spirit: 'angel', text: '做一件小时候特别喜欢的小事——折纸、吹泡泡、跳格子……', tags: { type: 'action', cat: 'childhood', time: 'any', social: 0, repeatable: true, place: 'any' } },

  // ============ 渐进式陪伴试点蛋（p1 + p2..p6，见 PILOT_EGG_IDS）============
  // 实验：把「给一个任务」升级为「陪用户完成一次微型现实体验」。
  // 有 steps 的蛋走「一次只做最小一步」的引导流程；steps 由人工编写，保证文案与步骤一致。
  // 覆盖 demon/angel × indoor/outdoor/any，保证夜晚（place=indoor）也能遇到陪伴蛋。

  // p1 · demon · outdoor（小恶魔：偏离）
  {
    id: 'p1',
    spirit: 'demon',
    text: '回家路上，找一家你从来没进去过的小店，进去看看。',
    tags: { type: 'action', cat: 'explore', time: 'day', social: 0, repeatable: false, place: 'outdoor' },
    difficulty: 2,
    estimated_duration: '5 分钟',
    requires_photo: false,
    steps: [
      {
        trigger: '现在',
        instruction: '今天不用急着做。等你回家或出门的路上，帮我留意一下：路上有没有一家你从没进去过的小店。',
        friction_hint: '不用专门去找，只是顺便看一眼。',
        completion_condition: '你留意到了一家让你有点好奇的小店。',
      },
      {
        trigger: '看到那家店时',
        instruction: '就是它。不用买东西，也不用跟任何人说话。如果你愿意，进去待 30 秒就好。',
        friction_hint: '30 秒，转身就能出来。',
        completion_condition: '你走进了那家店。',
      },
      {
        trigger: '在店里',
        instruction: '找一样让你觉得有点意思的东西。不用买下来。',
        friction_hint: '可以是价格牌、一个摆件、一句店里的音乐。',
        completion_condition: '你看到了那个让你觉得有意思的东西。',
      },
      {
        trigger: '做完以后',
        instruction: '回到这里，把这一刻告诉我吧。拍不拍照都行，一句话也可以。',
        friction_hint: '',
        completion_condition: '你回到了 BeginHere。',
      },
    ],
  },

  // p2 · demon · outdoor（小恶魔：偏离路线）
  {
    id: 'p2',
    spirit: 'demon',
    text: '今天走路的时候，换一条从没走过的路。',
    tags: { type: 'notice', cat: 'route', time: 'day', social: 0, repeatable: false, place: 'outdoor' },
    difficulty: 1,
    estimated_duration: '走路顺路',
    requires_photo: false,
    steps: [
      {
        trigger: '现在',
        instruction: '今天不用特意出门。等下次你出门或回家时，试着选一条从没走过的路，哪怕只是一小段。',
        friction_hint: '不用绕很远，一小段就行。',
        completion_condition: '你选了一条从没走过的路。',
      },
      {
        trigger: '走在那条路上',
        instruction: '慢下来一点，看看这条路上有什么你以前没注意过的东西——一棵形状奇怪的树、一扇特别的窗、一个招牌。',
        friction_hint: '只是看，不用停下来拍照。',
        completion_condition: '你发现了某个以前没注意过的东西。',
      },
      {
        trigger: '回来以后',
        instruction: '回到这里，把那个东西告诉我吧。一句话就行。',
        friction_hint: '',
        completion_condition: '你回到了 BeginHere。',
      },
    ],
  },

  // p3 · demon · any（小恶魔：随机尝鲜）
  {
    id: 'p3',
    spirit: 'demon',
    text: '找一首你从来没听过的歌，完整地听完它。',
    tags: { type: 'action', cat: 'media', time: 'any', social: 0, repeatable: true, place: 'any' },
    difficulty: 1,
    estimated_duration: '一首歌',
    requires_photo: false,
    steps: [
      {
        trigger: '现在',
        instruction: '不用现在就开始。等你想听点东西的时候，打开音乐软件，找一首你完全没听过的歌——从随机推荐里挑就行。',
        friction_hint: '不用精心挑选，随便点一首。',
        completion_condition: '你找到了一首没听过的歌。',
      },
      {
        trigger: '播放时',
        instruction: '戴上耳机或开着外放都行，完整地听完它。不用评价好坏，只是听完。',
        friction_hint: '三到五分钟而已。',
        completion_condition: '你完整听完了那首歌。',
      },
      {
        trigger: '听完以后',
        instruction: '回到这里，告诉我那首歌给你的感觉吧。一句话就行。',
        friction_hint: '',
        completion_condition: '你回到了 BeginHere。',
      },
    ],
  },

  // p4 · angel · indoor（小天使：回到过去的声音）
  {
    id: 'p4',
    spirit: 'angel',
    text: '重新听一首你以前单曲循环过的歌。',
    tags: { type: 'action', cat: 'media', time: 'any', social: 0, repeatable: true, place: 'indoor' },
    difficulty: 1,
    estimated_duration: '一首歌',
    requires_photo: false,
    steps: [
      {
        trigger: '现在',
        instruction: '想一想：你以前有没有哪首歌，曾经单曲循环过很多遍？',
        friction_hint: '不用翻歌单，凭记忆想一首就行。',
        completion_condition: '你想起了一首以前反复听的歌。',
      },
      {
        trigger: '找到它时',
        instruction: '把这首歌再放一遍。不用想太多，只是让它在房间里响着。',
        friction_hint: '一首歌的时间而已。',
        completion_condition: '那首歌又响起来了。',
      },
      {
        trigger: '听完以后',
        instruction: '回到这里，告诉我你现在的感受吧。和以前听的时候有什么不一样，都可以。',
        friction_hint: '',
        completion_condition: '你回到了 BeginHere。',
      },
    ],
  },

  // p5 · angel · indoor（小天使：物归原处）
  {
    id: 'p5',
    spirit: 'angel',
    text: '找出一件你以前很喜欢、现在收起来的东西，把它放回看得见的地方。',
    tags: { type: 'action', cat: 'memory', time: 'any', social: 0, repeatable: true, place: 'indoor' },
    difficulty: 1,
    estimated_duration: '几分钟',
    requires_photo: false,
    steps: [
      {
        trigger: '现在',
        instruction: '回忆一下，你有没有一件以前很喜欢、后来收起来的东西？不用现在就想出来。',
        friction_hint: '想不出来也没关系，想到哪件算哪件。',
        completion_condition: '你想到了一件以前喜欢的东西。',
      },
      {
        trigger: '找到它时',
        instruction: '把它找出来，拿在手里看一看。它现在是什么样子？',
        friction_hint: '不用擦干净，也不用急着放回原处，先看看就好。',
        completion_condition: '你看到了那件东西。',
      },
      {
        trigger: '看完以后',
        instruction: '把它放到一个你能看见的地方。不用讲究位置，看得见就行。',
        friction_hint: '窗边、桌上、书架，哪儿都行。',
        completion_condition: '那件东西回到了你能看见的地方。',
      },
      {
        trigger: '做完以后',
        instruction: '回来告诉我它是什么、现在放在哪吧。一句话也行。',
        friction_hint: '',
        completion_condition: '你回到了 BeginHere。',
      },
    ],
  },

  // p6 · demon · indoor（小恶魔：只做五分钟）
  {
    id: 'p6',
    spirit: 'demon',
    text: '找一件你「一直想做但嫌麻烦」的小事，只做五分钟。',
    tags: { type: 'action', cat: 'break', time: 'any', social: 0, repeatable: true, place: 'indoor' },
    difficulty: 2,
    estimated_duration: '5 分钟',
    requires_photo: false,
    steps: [
      {
        trigger: '现在',
        instruction: '想一想，有没有一件你「一直想做，但总觉得麻烦」的小事？不用现在动手。',
        friction_hint: '想不起来的话，就想想那件最常被你推迟的事。',
        completion_condition: '你想起了一件事。',
      },
      {
        trigger: '想到它时',
        instruction: '现在只做五分钟。就五分钟——先把最麻烦的部分跳过，只做最简单的第一步。',
        friction_hint: '五分钟一到，不想做就可以停。',
        completion_condition: '你做了五分钟。',
      },
      {
        trigger: '做完以后',
        instruction: '回到这里，告诉我你做了那五分钟，感觉怎么样。',
        friction_hint: '',
        completion_condition: '你回到了 BeginHere。',
      },
    ],
  },
]

// 彩蛋是「参考答案」不是任务：用户可自行调整方向，但要有可点的具体建议降门槛。
// 每个蛋配 2 条同语义的变体（把「换一条路」改成「换一种交通工具」这种），无 AI、按蛋写死。
export const CHEST_EGG_ADJUST: Record<string, string[]> = {
  d1: ['换成换一种交通工具回家（共享单车/没坐过的公交）', '换成换一个时间段走这条新路'],
  d2: ['换成点一道从来没喝过的饮品', '换成点平时永远不会点的口味/套餐'],
  d3: ['换成换一种方式来做这件事', '换成在另一个地点做'],
  d4: ['换成数一数路上遇到的红绿灯', '换成每走一层就留意一下墙上的东西'],
  d5: ['换成买一样小时候吃过的零食', '换成在路边摊买一样没试过的小吃'],
  d6: ['换成提前两站下车走完剩下的路', '换成中途换一条街绕回家'],
  d7: ['换成换一只不常用的手做小事（刷牙/拿杯子）', '换成把手机放口袋里走一段路'],
  d8: ['换成一部从没看过的短片', '换成一首从没听过的语言的歌'],
  d9: ['换成让店员推荐一款饮料', '换成点一杯平时会点但换成大杯/无糖'],
  d10: ['换成凭感觉选一个没坐过的公交站坐一站', '换成走到一个没去过的街区看看'],
  d11: ['换成数一数沿途一共有几家店', '换成留意沿途遇到了几只小动物'],
  d12: ['换成对楼下小店老板笑一下点点头', '换成跟常遇到的保安/同学说一句「今天怎么样」'],
  d13: ['换成把刷牙/出门的步骤顺序换一下', '换成先吃菜再吃饭'],
  d14: ['换成只做一分钟', '换成只做那件事的第一小步'],
  d15: ['换成换一条路回家', '换成特意观察路右边的风景'],
  a1: ['换成把收藏夹里最久没看的那条看完', '换成删掉收藏夹里再也不看的东西'],
  a2: ['换成重新看一部小时候的动画', '换成重新做一次以前常做的小事（画画/写字/做饭）'],
  a3: ['换成去附近没去过的一条街走走', '换成故地重游但换一种方式到那里'],
  a4: ['换成发一句「最近怎么样」', '换成给长辈发一句问候'],
  a5: ['换成翻旧手机/旧相册里某一年', '换成找一张小时候的照片仔细看看'],
  a6: ['换成重新看一段以前循环过的视频', '换成戴上耳机安静听一遍'],
  a7: ['换成重做一次以前常做的某道菜', '换成重新拿起很久没碰的乐器/球/画笔'],
  a8: ['换成买一样小时候家里常做的东西', '换成买一样包装很眼熟的零食'],
  a9: ['换成写给十年前的自己一句话', '换成把某个遗憾的瞬间重新写一遍'],
  a10: ['换成把它拿出来用一天', '换成把它擦干净送给能用上的人'],
  a11: ['换成听一段小时候常听的旋律', '换成看小时候照片里的那个场景'],
  a12: ['换成做一次以前会做的折纸/手工', '换成写一行以前会写的字'],
  a13: ['换成给「未来的自己」写一句提醒', '换成把这句话写在便利贴上贴起来'],
  a14: ['换成给对方发一句「我一直留着它」', '换成把它擦干净放回显眼处'],
  a15: ['换成用小时候的方式过五分钟', '换成教旁边的人做这个小事'],
  p1: ['换成在门口看一眼你从没进过的那家店', '换成去一家常路过但从没进去的早餐店/便利店'],
  p2: ['换成换一种交通工具回家', '换成换一个下班/放学时间走'],
  p3: ['换成一部从没看过的短片看完', '换成一首从没听过的语言的歌'],
  p4: ['换成重新看一段以前循环过的片段', '换成戴上耳机安静听一遍'],
  p5: ['换成把它拿出来用一天', '换成把它擦干净拍照留念'],
  p6: ['换成只做一分钟', '换成只做它的第一步'],
}

export interface ChestObjectDef {
  id: string
  baseName: string
  baseMeaning: string
  artKey: string
  tags: string[]
}

// 物件语义关键词：AI 起名/寓意与「物件类型」可能错位（比如起了「一片叶子」却选了 star），
// 用名字关键词把类型纠正回来，保证图标与名字一致。需与 BeginHere 侧 pixel-icons.ts 保持一致。
export const OBJECT_KEYWORDS: Record<string, string[]> = {
  lamp: ['灯', '光', '微光', '希望', 'light', 'lamp', 'glow'],
  key: ['钥匙', '开启', '门', '锁', '解开', 'key', 'open'],
  cup: ['杯', '茶', '沿', '接住', '日常', '杯沿', 'cup', 'tea', 'mug'],
  seed: ['种子', '种', '叶', '苗', '生长', '慢慢', 'seed', 'leaf', 'grow'],
  boat: ['船', '渡过', '离开', '小船', 'boat', 'ship'],
  paperplane: ['纸飞机', '飞机', '飞走', '折', 'paper', 'plane'],
  photo: ['照片', '回忆', '旧', '那时候', 'photo', 'memory', 'picture'],
  umbrella: ['伞', '保护', '挡', 'umbrella', 'rain'],
  book: ['书', '页', '记录', '未写完', '本子', 'book', 'page', 'journal'],
  star: ['星', '微光', '夜', '天空', 'star', 'night', 'twinkle'],
  sprout: ['芽', '新生', '嫩', '今天开始', 'sprout', 'bud'],
  heart: ['心', '爱', '跳', 'heart', 'love'],
  moon: ['月', '夜色', '安抚', 'moon', 'night'],
  candle: ['烛', '蜡', '暖', '守候', 'candle', 'flame', 'warm'],
  flower: ['花', '绽放', '新鲜', 'flower', 'bloom'],
  letter: ['信', '字', '倾诉', '未说出口', '笺', '写', '票', '小票', 'letter', 'mail', 'note'],
  compass: ['指南针', '方向', '决定', 'compass', 'direction'],
  stone: ['石', '沉稳', '踏实', '停摆', '不动', 'stone', 'rock', 'steady'],
  cloud: ['云', '放空', '轻盈', '灰色', '飘', 'cloud', 'gray', 'drift'],
  camera: ['相机', '定格', '此刻', '拍', 'camera', 'shot'],
}

// 用名字/寓意文本匹配最贴切的物件类型；无命中或多平票返回 null（交给调用方按原 id / 情绪兜底）
export function matchObjectByText(text: string): ChestObjectDef | null {
  const t = String(text || '').toLowerCase()
  if (!t) return null
  let best: string[] = []
  let bestScore = 0
  for (const o of CHEST_OBJECTS) {
    const kw = OBJECT_KEYWORDS[o.id] || []
    const score = kw.reduce((n, k) => (t.includes(k.toLowerCase()) ? n + 1 : n), 0)
    if (score > bestScore) {
      bestScore = score
      best = [o.id]
    } else if (score === bestScore && score > 0) {
      best.push(o.id)
    }
  }
  if (bestScore === 0) return null
  if (best.length !== 1) return null // 多类型平票 → 交给调用方
  return CHEST_OBJECTS.find((o) => o.id === best[0]) || null
}

export const CHEST_OBJECTS: ChestObjectDef[] = [
  { id: 'lamp', baseName: '一盏灯', baseMeaning: '希望 / 重新开始', artKey: 'lamp', tags: ['Rin', 'sad', 'tired', 'hopeful'] },
  { id: 'key', baseName: '一把钥匙', baseMeaning: '开启 / 新的门', artKey: 'key', tags: ['Ash', 'annoyed', 'bored', 'hopeful'] },
  { id: 'cup', baseName: '一只杯子', baseMeaning: '日常 / 也被接住', artKey: 'cup', tags: ['Rin', 'tired', 'sad'] },
  { id: 'seed', baseName: '一粒种子', baseMeaning: '生长 / 慢慢来', artKey: 'seed', tags: ['Child', 'sad', 'bored', 'hopeful'] },
  { id: 'boat', baseName: '一条小船', baseMeaning: '渡过 / 离开', artKey: 'boat', tags: ['Ash', 'sad', 'annoyed'] },
  { id: 'paperplane', baseName: '一架纸飞机', baseMeaning: '轻 / 飞走', artKey: 'paperplane', tags: ['Child', 'bored', 'hopeful'] },
  { id: 'photo', baseName: '一张旧照片', baseMeaning: '回忆 / 那时候', artKey: 'photo', tags: ['Rin', 'sad'] },
  { id: 'umbrella', baseName: '一把雨伞', baseMeaning: '保护 / 挡一下', artKey: 'umbrella', tags: ['Rin', 'tired', 'sad'] },
  { id: 'book', baseName: '一本书', baseMeaning: '记录 / 一页一页', artKey: 'book', tags: ['Ash', 'annoyed'] },
  { id: 'star', baseName: '一颗星星', baseMeaning: '微光 / 夜晚', artKey: 'star', tags: ['Rin', 'sad', 'tired'] },
  { id: 'sprout', baseName: '一株新芽', baseMeaning: '新生 / 今天开始', artKey: 'sprout', tags: ['Child', 'hopeful', 'bored'] },
  { id: 'heart', baseName: '一颗心', baseMeaning: '被爱 / 还在跳', artKey: 'heart', tags: ['Rin', 'sad', 'tired'] },
  { id: 'moon', baseName: '一轮月亮', baseMeaning: '安抚 / 夜色', artKey: 'moon', tags: ['Rin', 'sad', 'tired'] },
  { id: 'candle', baseName: '一支蜡烛', baseMeaning: '暖意 / 守候', artKey: 'candle', tags: ['Rin', 'tired', 'sad'] },
  { id: 'flower', baseName: '一朵花', baseMeaning: '绽放 / 新鲜', artKey: 'flower', tags: ['Child', 'happy', 'hopeful'] },
  { id: 'letter', baseName: '一封信', baseMeaning: '未说出口 / 倾诉', artKey: 'letter', tags: ['Rin', 'sad'] },
  { id: 'compass', baseName: '一个指南针', baseMeaning: '方向 / 决定', artKey: 'compass', tags: ['Ash', 'annoyed', 'bored'] },
  { id: 'stone', baseName: '一块石头', baseMeaning: '沉稳 / 踏实', artKey: 'stone', tags: ['Ash', 'annoyed', 'tired'] },
  { id: 'cloud', baseName: '一朵云', baseMeaning: '放空 / 轻盈', artKey: 'cloud', tags: ['Child', 'bored', 'tired'] },
  { id: 'camera', baseName: '一台相机', baseMeaning: '定格 / 此刻', artKey: 'camera', tags: ['Child', 'happy', 'bored'] },
]

// ------------------------------------------------------------
// 降级工具（迁移自 BeginHere server/chat.mjs）
// ------------------------------------------------------------

export function seed(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

export function dayKey(date = new Date()): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

type EmotionLike = { state?: string | null; score?: number | null }

// —— 每日确定性伪随机 ——
// 同一天（day += salt）内，同一 persona 拿到同一组随机数：物件/彩蛋选择稳定，情绪偏差仍浮动。
// Mulberry32：快速、可复现，替代 Math.random() 对「每日滤镜」的随机扰动。
// 每日滤镜本身是纯前端约定（BeginHere 侧只读），这里用 `seed(salt)` 当随机种子来源。
export function mulberry32(seedNum: number): () => number {
  return function () {
    let t = (seedNum += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 每日随机源：同一天同角色同派复现；salt 可为 deviceId 等设备级量
export function dailyRandom(persona: string, salt?: string, date = new Date()): () => number {
  return mulberry32(seed(persona + '|' + (salt || '') + '|' + dayKey(date)))
}

function eggBias(
  egg: EggDef,
  persona: ChestPersonaId,
  emotion: EmotionLike | undefined,
  rnd: () => number,
  placeHint?: 'indoor' | 'any',
): number {
  let s = rnd() * 2
  if (egg.tags.social === 1) s += persona === 'Rin' ? 2 : 0
  if (egg.tags.cat === 'memory' || egg.tags.cat === 'childhood') s += persona === 'Child' ? 2 : 0
  if (egg.tags.type === 'action') s += persona === 'Ash' ? 1 : 0
  if (emotion?.state === 'tired' && ['rest', 'restart'].includes(egg.tags.cat)) s += 3
  if (emotion?.state === 'bored' && egg.tags.type === 'action') s += 2
  // 渐进式陪伴实验蛋：p1..p6 带 steps，给更高频让实验拿足「接受→完成」数据；实验结束移除
  const PILOT_EGG_IDS = new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'])
  if (PILOT_EGG_IDS.has(egg.id)) s += 1.5
  // 场景分流：夜晚/居家时强烈压低「要出门」的蛋，偏好在家即可完成的
  if (placeHint === 'indoor') {
    if (egg.tags.place === 'outdoor') s -= 6
    else if (egg.tags.place === 'indoor') s += 2
  }
  return s
}

export function pickFallbackEgg(
  persona: ChestPersonaId,
  emotion?: EmotionLike,
  salt?: string,
  placeHint?: 'indoor' | 'any',
): EggDef {
  const list = [...CHEST_EGGS]
  const rnd = dailyRandom(persona, salt)
  const nudged = list.map((e) => ({ e, s: eggBias(e, persona, emotion, rnd, placeHint) }))
  nudged.sort((a, b) => b.s - a.s)
  return nudged[0].e
}

function objectScore(o: ChestObjectDef, persona: ChestPersonaId, emotion: EmotionLike | undefined, rnd: () => number): number {
  let s = rnd() * 2
  if (o.tags.includes(persona)) s += 3
  if (emotion?.state && o.tags.includes(emotion.state)) s += 3
  if (o.tags.includes('hopeful')) s += Math.max(0, 5 - (emotion?.score || 5))
  return s
}

export function pickFallbackObject(persona: ChestPersonaId, emotion?: EmotionLike, salt?: string): ChestObjectDef {
  const rnd = dailyRandom(persona, salt)
  return [...CHEST_OBJECTS]
    .map((o) => ({ o, s: objectScore(o, persona, emotion, rnd) }))
    .sort((a, b) => b.s - a.s)[0].o
}

export function titleFromEmotion(emotion?: EmotionLike): string {
  const map: Record<string, string> = {
    happy: '今天有光',
    tired: '慢慢的一天',
    annoyed: '一点小躁动',
    sad: '今天有点沉',
    bored: '空白卡片',
  }
  return map[emotion?.state || ''] || '今天的碎片'
}

export interface ChestBuildLocalInput {
  persona: ChestPersonaId
  emotion?: EmotionLike
  /** 设备级盐（如 eh_device_id），同设备同角色同日期时结果稳定 */
  salt?: string
}

export function buildLocalResult({ persona, emotion, salt }: ChestBuildLocalInput) {
  const egg = pickFallbackEgg(persona, emotion, salt)
  const obj = pickFallbackObject(persona, emotion, salt)
  const eggPayload: Record<string, unknown> = { id: egg.id, text: egg.text }
  if (egg.steps?.length) {
    eggPayload.steps = egg.steps
    if (egg.difficulty) eggPayload.difficulty = egg.difficulty
    if (egg.estimated_duration) eggPayload.estimated_duration = egg.estimated_duration
  }
  if (CHEST_EGG_ADJUST[egg.id]) eggPayload.adjust = CHEST_EGG_ADJUST[egg.id]
  return {
    reply: CHEST_PERSONAS[persona]?.greeting || '嗯。',
    title: titleFromEmotion(emotion),
    egg: eggPayload,
    object: {
      id: obj.id,
      name: obj.baseName,
      meaning: obj.baseMeaning,
      desc: `${obj.baseName}——${obj.baseMeaning}。`,
    },
  }
}

export const CHEST_FALLBACK_REPLIES: Record<ChestPersonaId, string> = {
  Ash: '嗯，先记下来。往下只问一句：这件事，哪一部分是你真正在意的？',
  Rin: '能感觉到你现在有点不好。不急着解决，先说给我听。',
  Child: '哇，听起来像个小故事。后来呢？',
}

export function fallbackReply(persona: ChestPersonaId): string {
  return CHEST_FALLBACK_REPLIES[persona] || CHEST_FALLBACK_REPLIES.Rin
}

// ------------------------------------------------------------
// 危机安全层（Safety Layer > Persona）
// 统一处理自杀/自伤信号，不受当前人格影响；一旦命中，绕过
// 彩蛋/offer/小票机制，改为引导现实求助。
// ------------------------------------------------------------

export type CrisisLevel = 1 | 2 | 3 | 4

// ④ 高风险 / 临近行动：明确的行动意图 + 时间/方法，必须立即求助
const CRISIS_HIGH: RegExp[] = [
  /(已经|就要|准备|打算|决定|今晚|马上|现在|待会|等会|一会儿|下班后|周末|明天).{0,12}(自杀|去死|了结|结束自己|死掉|割腕|跳楼|跳桥|上吊|烧炭|服安眠药|吃药|伤害自己|自残)/,
  /(自杀|自残|跳楼|跳桥|上吊|割腕|烧炭|服毒|吃安眠药).{0,12}(已经|就要|准备|打算|今晚|马上|现在|工具|药|刀|绳子)/,
  // 无核心词的临近行动表达（今晚就去做 / 东西都备好了）
  /(今晚|现在|马上|待会|一会儿|已经|就要|准备|打算|决定).{0,6}(去做|动手|实施|了结|结束一切|结束自己)/,
  // 英文：明确时间/准备 + 结束生命
  /(tonight|today|now|right now|soon|later|after work|this weekend|tomorrow|have already|about to|going to|planning to|ready to).{0,24}(kill myself|end my life|end it all|take my own life|hurt myself|harm myself)/i,
  /(kill myself|end my life|take my own life|suicide).{0,24}(tonight|today|now|right now|soon|after work|this weekend|tomorrow|have already|about to|planning|ready)/i,
]

// ③ 明确意图：表达「想死/想自杀/不想活」但没有临近行动
const CRISIS_INTENT: RegExp[] = [
  /(我|自己)?(想|要|打算|真的想|好想)(自杀|去死|死掉|了结|结束自己|离开这个世界|不活了|消失)/,
  /不想(活|继续活|活着|再活|面对这一切)/,
  /活着(没有|没|没什么|毫无)(意思|意义|价值|盼头|动力)/,
  /(希望|宁愿|恨不得)(自己)?(死|消失|没出生)/,
  // 英文：明确求死
  /(i\s*('?m\s*)?(just|really|honestly|so|definitely)?\s*(want|wish|would\s*like|have\s*decided|am\s*thinking|'?m\s*thinking)\s*(so\s*)?(to\s*)?(kill\s*myself|die|end\s*my\s*life|end\s*it\s*all|not\s*be\s*alive|not\s*exist|disappear|take\s*my\s*own\s*life))/i,
  /(i\s*(don.t|do not|can.t|can not|no longer)\s*want\s*to\s*(live|be\s*alive|go\s*on|keep\s*living|continue|be\s*here))/i,
  /(life|living)\s*(has|holds)?\s*(no|nothing|zero)\s*(meaning|point|purpose|worth|hope)/i,
  /i\s*(don.t|do not)\s*(want\s*to\s*)?(wake\s*up|be\s*here|exist)/i,
  /(i\s*(just|really|honestly|sometimes)?\s*(wish|wished|hope)\s*(i\s*)?(could|would|can|'d|was|were)\s*(just\s*)?(disappear|not\s*exist|be\s*gone|be\s*dead|be\s*dead\s*and\s*gone|kill\s*myself|dead))/i,
]

// ② 被动/模糊自伤：提及痛苦但未明确求死，需谨慎回应并确认状态
const CRISIS_PASSIVE: RegExp[] = [
  /(有时候|偶尔|经常|总|一直).{0,8}(觉得|感觉|想).{0,8}(活着没|没意思|撑不下去|坚持不下去|承受不了|熬不下去|太累|扛不住)/,
  /(撑不下去|熬不下去|坚持不下去|承受不了|扛不住|没力气活下去|看不到头)/,
  /(没有)(意义|希望|盼头|动力|方向)/,
  /(不想|无法|难以).{0,6}(面对|应付|承受|处理)/,
  // 英文：被动痛苦表达
  /(i\s*(sometimes|often|always|keep|feel|am)\s*(so|really|just|very|all)?\s*(like\s*)?(i\s*)?(giving up|can't go on|cant go on|can't keep going|cant keep going|falling apart|breaking down|drowning|hopeless|worthless|empty|numb))/i,
  /i\s*(don.t|do not|can.t|can not|cant)\s*(see|have|find|feel\s+there\s+is)\s*(any\s*)?(point|hope|way\s*out|reason)/i,
  /there\s*(is|seems\s+to\s+be)\s*no\s*(point|hope|reason|way\s*out)/i,
  /i\s*feel\s*(like|that)\s*(i\s*)?(am\s*)?(a\s*)?(burden|failure|nothing)/i,
]

// ① 普通提及：提到自杀/自伤但显然不是本人处境（他人/新闻/作品）→ 走正常流程
export function detectCrisis(messages: { role: string; content: string }[]): CrisisLevel | null {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n')
    .trim()
  if (!userText) return null

  // 普通提及（他人/作品/新闻）不触发危机层——但保留对「我自己也是」这类反转的检测
  const personalRef = /(我|自己|我真的|我也|我是|我现在)/.test(userText)
  const thirdPerson = /(朋友|同学|同事|家人|妹妹|弟弟|姐姐|哥哥|妈妈|爸爸|邻居|网友|听说|新闻|报道|电影|剧|角色|小说|书里|某|一个)/.test(userText)

  // 只有明显是「他人/作品」且无「我」的第一人称表述，才判定为普通提及
  if (thirdPerson && !personalRef) return null

  if (CRISIS_HIGH.some((re) => re.test(userText))) return 4
  if (CRISIS_INTENT.some((re) => re.test(userText))) return 3
  if (CRISIS_PASSIVE.some((re) => re.test(userText))) return 2
  return null
}

// 各等级的安全回复（固定文案，不受人格影响；含英文版）
// level 1（普通提及）不触发危机层，detectCrisis 只返回 2/3/4；此处类型上兜底。
export const CRISIS_REPLIES: Record<CrisisLevel, { zh: string; en: string }> = {
  1: { zh: '', en: '' },
  2: {
    zh: '听到你说这些话，我有些担心你。现在感觉很难受的话，不用硬撑——你愿意跟我多说说发生了什么吗？如果此刻痛苦已经压得你喘不过气，也请记得联系一个你信任的人，或拨打心理援助热线（如北京 010-82951332）。你不需要一个人扛着。',
    en: "I'm a little worried about you after reading that. You don't have to carry this alone—can you tell me a bit more about what's going on? If the pain feels overwhelming right now, please reach out to someone you trust, or a support line (e.g. in many countries you can call a local crisis line). You don't have to face this by yourself.",
  },
  3: {
    zh: '谢谢你愿意把这些告诉我。你现在心里一定很痛，我不想随便给你一句安慰就带过。如果你已经产生了想结束生命的念头，请先别一个人待着——联系身边信任的人，或拨打 24 小时心理援助热线（北京 010-82951332；或手机端 12356）。让我陪你到联系上他们为止，好吗？',
    en: "Thank you for trusting me with this. What you're feeling sounds very painful, and I don't want to brush past it. If you're having thoughts of ending your life, please don't stay alone—reach out to someone you trust, or call a 24h crisis/suicide prevention line in your region. I'll stay with you until you've reached them, okay?",
  },
  4: {
    zh: '我听到了，也看到了你的痛苦。请你现在立刻放下手里的东西，联系你身边能最快见到的人，或者拨打紧急求助电话。你的生命很珍贵，值得被救——请现在就打电话给信任的人或心理危机干预热线（北京 010-82951332；全国 12356），他们能马上帮你。我会一直在这里等你。',
    en: "I hear you, and I see how much pain you're in. Please stop what you're doing right now and reach out to someone who can be with you immediately, or call an emergency/crisis line now. Your life matters, and you deserve help—please call someone you trust or a suicide prevention hotline (in your country) right now. I'll be here with you.",
  },
}
