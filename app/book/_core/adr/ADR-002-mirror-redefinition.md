# ADR-002: Mirror Redefinition

- **Status**: Accepted
- **Date**: 2026-07-15
- **Replaces**: `mirror.v3.archived.md`（原 `mirror.research.md`，已归档）
- **Supersedes**: Constitution §3 第四层 V3 描述（已在 constitution.md 内原地重写）
- **Supersedes behavior of**: `MirrorTopicPanel.tsx` / `/v2/api/mirror/analyze` / `BookNavigator` 中 `mirrorMarks`（V3 残留，不强制删除但不再作为 Mirror 行为依据）

---

## Context

V3 的 Mirror 把自己定位为「**摄像机**」——架在用户生活旁、基于 Reality 坐标在时间窗内发现 Echo、陈列重复、问「你有没有发现?」。

它在「解决用户看不见自己」这件事上设计得不错，但在 Book Voice 出现、`Book` 这个产品定义成形之后，仓库里逐渐出现一个无法忽视的矛盾:

> 如果产品里已经有一本「活着的书」，那么 Mirror 就不该是一面镜子；
> 它应该是这本书自己留下的记忆。

V3 Mirror 把镜头**对准用户**——「镜子照向用户」。
新建模把镜头**对准书**——「书经过时间之后的样子」。

两者不兼容:

- 旧 Mirror 等到 ≥3 个相同坐标的碎片才生成；新 Mirror 第一页写完就反应。
- 旧 Mirror 必须有 Reality 抽取 + Echo 发 现；新 Mirror v0.1 全人工文案、不接 LLM。
- 旧 Mirror 是独立页面；新 Mirror 是页边注、与书写页同场。

继续在 V3 的文档之上追加新规范会让世界观自我矛盾；分叉实现会让产品出现两套同名但语义不同的 Mirror。这是结构性问题，不是优化问题。

---

## Decision

### D1. Mirror 重定义

```
V3:  Mirror = Insight  (analytical surface reflecting the user)
V4:  Mirror = Memory   (memory layer of a living book)
```

英文锚句:

> **Mirror is not an analysis engine. Mirror is the memory layer of a living book.**

中文工作锚句:

> Mirror 不再试图回答「你是谁?」，而开始回答「我们一起走到了哪里?」。

### D2. 世界观闭环

```
Response              回应一页
Mirror                记住一路
Curiosity             因一路而起,有点想知道
Book                  最终,这本书活了起来
```

四件事在此刻第一次连成闭环。宪法 §3 第四层已据此重写。

### D3. v0.1 MVP 范围（五事件）

落地版本见 `mirror.v4.md §3.2`。摘要:

- 4 个常规事件 + 1 个破冰事件 `book_first_arrived`（受 §1.4 First-Arrival Exemption 授权）。
- 全人工文案，不接 LLM。
- 页边注形态，禁用任何 AI 视觉语言（气泡 / 卡片 / 蓝紫渐变 / 打字机动画）。
- 仅 `first_page_born` / `revisit_old_page` / `page_modified` 进入 Settled，其余仅 Active。

### D4. 旧 V3 资产处理

- `mirror.research.md` → git mv 至 `mirror.v3.archived.md`，文件头加 STATUS: ARCHIVED 横幅，保留可追溯。
- `MirrorTopicPanel.tsx` / `/v2/api/mirror/analyze` / `BookNavigator.mirrorMarks` 不强制删除，标记为 V3 残留。下一版统一评估是否回收 / 重构 / 移除。
- Constitution §10 已新增两条废止条款，防止旧世界观回流。

### D5. 隐私与安全红线

- Mirror 这一层不存原文、不传 LLM；只记**事件类型 + 时刻 + 涉及页 ID**。
- 所有 LLM 入口接入 `lib/inputGuard.ts`（已在 organize route / RealityExtractor / basket put 完成）。
- `book_first_arrived` 的去重标记 `book_first_arrived_fired` 仅写本地 localStorage，不上云。

---

## Consequences

### 正面

- 产品哲学统一:从「分析用户」转为「与书共行」。
- 实现成本骤降:v0.1 全人工文案、无 LLM、无聚合后端，代码层只在客户端。
- 与 Book Voice 形成两支不冲突:Book Voice = 翻开那一刻书的开嗓；Whisper = 事件之后书在页边留的一行。
- Constitution §10 的废止条款阻止旧世界观回流。

### 负面 / 已知风险

1. **V3 残留代码的存在**:旧 Mirror 页面还在 `/v2/mirror` 跑，用户进得去。短期可接受，长期要决定回收还是下线。这是技术债，本 ADR 不替它做决策。
2. **First-Arrival Exemption 是一项例外**:一旦立例，将来其他事件可能想类比「我也是初次相遇」来申请沉默豁免。ADR-002 对此明确**只授权 `book_first_arrived` 一类**，不延伸。
3. **relationship_state 灰区**:文档允许后台静默记录 Relationship State 但 v0.1 不用。一旦后续版本使用，必须再开 ADR。
4. **Book Whisper 与 Book Voice 的命名混淆**:Book Voice 已是翻开书时 15% 概率的一次发声（`bookVoice.ts`）；Book Whisper 是事件之后的页边注（`whisper.ts`，本 ADR 引入）。两者不共文案池、不共触发、不共位置。命名上已尽力区分，但团队沟通成本会持续存在。

---

## Success Criteria

不是「留存提升」「DAU 增加」。只有定性 + 定量各一条:

### 定性

> 第一批用户里，哪怕一个用户,自己说出来一句类似:
>
> > 「奇怪，我感觉这本书记得一些东西。」

如果第一次用户反馈是:

> 「Mirror 好聪明，它分析得真准。」

——v0.1 失败，漂移回 V3 旧世界观。

### 定量

`v4_whisper_shown` 与该页随后是否被记录到下一步用户动作（写一段 / 翻页 / 离开）的转化，与无 Whisper 的对照组对照——若 Whisper 让用户**更不想写**或**更急于离开**，则频率需调低或事件需删除。这是 `mirror.v4.md §1.3 Silence Principle` 与 Constitution §5 约束 A 在数据层的兑现。

---

## ADR-001 状态

EndHere 此前未建立 ADR 系列,本文件即首份 ADR。后续所有世界观级决策走同一流程（短模板）:

- Status / Date / Context / Decision / Consequences / Success Criteria
- 文件名:`adr/ADR-XXX-short-slug.md`
- Accepted 至 `mirror.v4.md` 等同立法,官方来源改回与 `constitution.md` 联动促进。

---

## 修订记录

### 2026-07-15 修订 R1:破冰事件语义重写

**触发**:首版 v0.1 文案池过弱（「你来了。」/「第一页,在这里了。」），用户感知不到「这里有一个记忆层在工作」；以及 `WhisperLayer` 位置 `bottom-6` 与「写下这一页」按钮之间重叠。

**修订**:

- `mirror.v4.md` §1.4 重写。从「破冰只允许陈述相遇事实、禁止『我 / Mirror』」改为「破冰允许陈述自己的工作 / 承认自己在场,但仍然禁止自我介绍成 AI 角色 / 助手 / 聊天对象」。
- 新增合法 / 越界范例对照表（见 §1.4）。左边一类可直接用作破冰文案,右边一类仍然违宪。
- §3.2 #0 表的示例改写,文案池替换为:
  - 我会记住这本书留下的痕迹。
  - 从这一页开始,这本书有了自己的记忆。
  - 我在这里,为这本书作见证。
  - 我记得第一页是什么时候打开的。
  - Mirror 在等。
- `WhisperLayer.tsx` 位置由 `bottom-6` 改为 `bottom-20` (`80px`) 以避开写入按钮。
- `WhisperLayer.tsx` 引入「破冰事件视觉明显一档」规则:字号 12px、透明度 75 (常规 active 11px / 55)。颜色仍锁 stone 系灰黑,不放宽到蓝紫渐变。
- `whisper.ts` `POOL['book_first_arrived']` 全部替换为上述范例。

**未修订**:

- 常规事件 (#1–#4) 的语义与颜色仍按 §1.2 / §1.3 / §2.1 原 §2.4 铁律 —— 没有滚雪球式把第一人称 / 视觉更高对比度扩展到常规 Whisper。
- `book_first_arrived` 仍 Active-only、不 Settle。一设备仍仅触发一次。

**回退条件**:若用户看到破冰 Whisper 第一反应是「嗨 Mirror」并尝试与之对话——这暗示 Mirror 已漂移成 AI 助手,需撤销 R1 修订、回到初版只允许陈述事实的契约。该信号由本 ADR §Success Criteria 监测。

---

## 一句话总结

> 整个产品突然统一了:
> Response 回应一页；Mirror 记住一路；Curiosity 因为一路而起；Book 最终活了起来。
> 这是 EndHere 从一个 AI 产品真正跨入「Living Book」世界观的分水岭。
