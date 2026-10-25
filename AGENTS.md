<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:authority-docs -->
# 改代码前先看权威文件

产品机制与视觉的**唯一依据**是 `app/book/_core/constitution.md` ＋ `docs/authority/2026-10/`（2026-10-24/25 Brian 定案：批注机制、十张牌意象、故事书视觉方向、BH 人格语言 v1）。

`docs/01`–`03`、`README.md` 是 **v3.2 历史存档**，描述的是「漫游区／焚烧小票／九宫格／双轨制」，那些机制在代码里已经不存在。**不得据此改动。**

一句话产品定义：一本故事书。带着一个问题翻开 → 写下记忆点 → 书以人格批注接住 → 用户宣告讲完整 → 翻一张牌＋一句金句 → 合上。一页一张牌，且在最后。
<!-- END:authority-docs -->

<!-- BEGIN:p1-hard-constraints -->
# P1 两条硬约束（改这些地方之前先读）

**1. 正文只能来自用户原话。** 页正文永远是 `page.paragraphs[].text` 按顺序拼接（只补标点与换行）。
代码里**不允许存在**让模型改写/润色/缩写正文的路径。`quote`（金句）与 `title`（标题）可以生成，正文不行——话不能代笔。

**2. 牌是固定枚举，资产是固定路径。**
- 牌名只在 `app/book/_core/cards.ts` 的 `CARD_IDS` 十张里选（灯／镜子／层／路／门／书页／蛋／潮／窗／杯子）。
  模型给了枚举外的牌名 → `normalizeCardId` 返回 null → `fallbackCardId(persona)` 兜底并**记一条日志**，绝不让模型自由命名。
- 资产路径只认三个：`/cards/{id}-color.webp`（落页插画）、`/cards/{id}-line.webp`（翻牌线条）、`/cards/card-back.webp`（写态中性卡背）。
  **卡背绝不能是某张牌的线条版**——那等于提前泄露抽卡结果。
- 牌只出意象，不存牌意，不写正位/逆位，不预测。
<!-- END:p1-hard-constraints -->

<!-- BEGIN:precommit-testing -->
# 提交纪律（强制，任何 commit/push 之前必须全部通过）

> 教训：SSR / build / 纯接口测试通过 ≠ 客户端正常。曾因只在 SSR/HTTP 层验证而漏掉
> 纯前端的运行时 bug（zustand onRehydrateStorage 里的 TDZ 崩溃），导致线上 /book 全黑屏。

**任何提交前，必须跑完整测试，逐项确认，缺一不可：**

1. `npx eslint` 相关文件 —— 0 error（新增文件必须干净，不留新 error）
2. `npx tsc --noEmit` —— 0 error
3. `npx next build` —— 成功，关键路由都在
4. API 冒烟 —— 用真实请求打关键 POST/GET（organize / ways / mirror-analyze / visit-log / annotations 等）
5. **真实浏览器冒烟（必做，此前唯一缺漏的环节）** —— 用本机 Chrome/Edge（`puppeteer-core` + `executablePath` 指向已装的 Chrome）逐页加载关键页面：
   - `/`（应 302 到 /book）
   - `/book`（必须能看到封面色块与文案，如「翻开第一页 / ENDHERE」，且 `document.body.innerText` 非空）
   - `/book/ways`、`/book/mirror`
   - **`legacy-only`（无入站链接的孤岛页，2026-10-25 标注）**：`/book/fragments/new`、`/book/resting`。
     仅需确认加载不崩、无 `pageerror`，**不纳入功能验收**——它们没有入口，为一个用户到不了的页面做验收没有意义。
     删留待 UI 大改之后再议；连带 `app/book/_core/windows.ts`、`app/book/_core/artifacts/` 同为孤岛，改动时不要顺手删。
   - 判定标准：页面渲染出正文（非空 innerText）、无 `pageerror`、无 `shell`(`.min-h-screen.bg-[#110f0e]`)残留
   - 至少覆盖：全新无 localStorage + 关键页面；如改动涉及 store/迁移，加损坏 localStorage 用例
   - 参考脚本位置：`C:\Users\Administrator\AppData\Local\Temp\opencode\verify.js`（每次用前可重生成）

全部通过后才能 `git add` / `commit` / `push`。禁止以"时间紧张"为由跳过任何一项。
<!-- END: 提交测试方式 -->
