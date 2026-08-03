<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
   - `/book/ways`、`/book/mirror`、`/book/fragments/new`、`/book/resting`
   - 判定标准：页面渲染出正文（非空 innerText）、无 `pageerror`、无 `shell`(`.min-h-screen.bg-[#110f0e]`)残留
   - 至少覆盖：全新无 localStorage + 关键页面；如改动涉及 store/迁移，加损坏 localStorage 用例
   - 参考脚本位置：`C:\Users\Administrator\AppData\Local\Temp\opencode\verify.js`（每次用前可重生成）

全部通过后才能 `git add` / `commit` / `push`。禁止以"时间紧张"为由跳过任何一项。
<!-- END: 提交测试方式 -->
