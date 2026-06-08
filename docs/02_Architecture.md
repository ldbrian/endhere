# Architecture - 《End Here》系统全栈技术架构白皮书

# Architecture - "End Here" Full-Stack Technical Architecture Whitepaper

## 1. 核心工程与数据隐私红线

## 1. Core Engineering & Data Privacy Redlines

* **[ZH] 绝对单页心流（SPA-First）**：全盘废弃 MPA 跳转。所有场景切换由 `useSpaceStore` 状态机管控，通过无缝淡入淡出及失焦溶解实现。
* **[ZH] 公私数据解耦架构（Public-Private Data Decoupling）**：具体倾诉文本、人名及事件细节绝对留存本地（Local Storage）；仅云端（Supabase）抽取并存储抽象的观点（Mind Track）与无定语的行为切片（Life Track）。
* **[EN] SPA-First**：Completely abandon MPA routing. All scene transitions are governed by the `useSpaceStore` state machine, realized through seamless fade-ins and out-of-focus dissolves.
* **[EN] Public-Private Data Decoupling**：Specific venting texts, names, and event details must remain strictly local (Local Storage). Only abstracted views (Mind Track) and modifier-free behavioral slices (Life Track) are extracted and stored in the cloud (Supabase).

## 2. ECS Lite 与惰性计算引擎

## 2. ECS Lite & Lazy Evaluation Engine

* **[ZH] 统一痕迹底座（Trace Registry）**：所有漫游区痕迹收束至 `entity_components` 表。废弃一切独立业务表（如 `physical_traces`）。强制要求所有时间戳写入正八区（UTC+8）。
* **[ZH] 惰性衰减机制（Lazy Decay Evaluation）**：严禁在后端编写用于状态推演的 CRON 轮询任务。所有痕迹的衰减（如木凳冷却、植物枯死），必须由前端在读取数据时计算时间差（$\Delta T$ = 当前时间 - 触发时间），并实时降维渲染文本 UI。
* **[EN] Trace Registry**：All roaming zone traces are consolidated into the `entity_components` table. Abandon all independent business tables. Mandatory enforcement of UTC+8 for all timestamps.
* **[EN] Lazy Decay Evaluation**：Strictly forbid writing backend CRON jobs for state derivation. The decay of all traces (e.g., stool cooling, plant wilting) must be calculated by the frontend upon data retrieval ($\Delta T$ = current time - trigger time), rendering the downgraded UI text in real-time.

## 3. 大模型（LLM）调用契约

## 3. LLM Invocation Contracts

* **[ZH] 静默提纯管道（Silent Extraction Pipeline）**：在 `/api/respond` 的多轮对话响应中，大模型必须在后台静默输出 JSON，分离提取 `mind_track` 与 `life_track`，不主动向用户发起有关生活细节的追问。
* **[ZH] 渐进式心流驱动（Progressive Flow Engine）**：发呆区废除静态数组循环。调用大模型按需生成细微环境观察，前端使用递进式时间戳数组（如 5s, 8s, 12s, 17s）配合递归 `setTimeout` 调度留白时间。
* **[EN] Silent Extraction Pipeline**：In the multi-turn `/api/respond` response, the LLM must silently output JSON in the background, separating `mind_track` and `life_track`, without actively interrogating the user about life details.
* **[EN] Progressive Flow Engine**：The Daydream zone abolishes static array loops. Call the LLM on-demand to generate subtle environmental observations. The frontend uses a progressive timestamp array (e.g., 5s, 8s, 12s, 17s) combined with recursive `setTimeout` to schedule blank intervals.

