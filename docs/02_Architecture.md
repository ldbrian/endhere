Architecture - 《End Here》系统全栈技术架构白皮书 (v3.2)
1. 核心工程与合规防线
[ZH] 绝对单页心流（SPA-First）：基于 Next.js + Tailwind CSS，全盘废弃 MPA 跳转。由 Zustand (useSpaceStore) 管控状态流转，实现无缝失焦与淡入淡出。

[ZH] 公私数据解耦与软删除（Data Decoupling & Soft Delete）：强制实行软删除逻辑。焚烧小票仅更新 status = 'incinerated' 并物理清空涉密文本，保留 UUID 与时间戳供时间轴渲染“灰烬”。

[ZH] 备案沙盒与 PWA 战略（Sandbox ICP & PWA Strategy）：为突破国内微信扫码红字拦截，锁定 PWA（渐进式 Web 应用）路线，并在申请 OPC 企业主体与域名 ICP 备案期间，采用“纯静态技术博客”作为前端路由沙盒伪装，确保合规通关。

[EN] Sandbox ICP & PWA Strategy: To bypass domestic WeChat red-screen warnings, secure the PWA route and implement a "static tech blog" frontend routing sandbox during the OPC corporate entity and ICP filing application to ensure compliance.

2. 空间网格与状态引擎
[ZH] 物理网格防撞系统（CSS Grid Spatial Engine）：漫游区废除 position: absolute 导致的 Z-Index 失控与重叠灾难。采用 3x3 空间网格，将痕迹（墙壁涂鸦、NPC状态）锁死在特定坐标，实行单条轮播状态机。

[ZH] 交互折叠（Interaction Folding）：核心操作区（如铁筐投递）必须应用状态机控制。默认收起为单行文本锚点，点击后平滑展开（Bottom Sheet / Modal），用完即折叠，维持环境极简呼吸感。

[ZH] 经济通胀锁（Anti-Inflation Locks）：利用 localStorage 配合 UTC+8 日期校验，在前端与 Zustand 中强控铁筐的每日单次 PUT/TAKE 动作，封死恶意刷接口的可能。

3. 大模型（LLM）调用契约
[ZH] API 意图守门人（AI Gatekeeper）：在 /api/basket/put 路由前置极轻量级 DeepSeek 审查 Prompt。强制拦截纯负能量发泄、谩骂与空洞成功学鸡汤，只允许“真实生活切片”入库。

[ZH] 静默提纯管道（Silent Extraction Pipeline）：/api/respond 必须在后台静默输出 JSON 格式，精准分离 mind_track 与 life_track。严禁 AI 向用户发起过度热情的反问。