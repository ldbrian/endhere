# Changelog - 《End Here》项目全域状态流转日志

# Changelog - "End Here" Global State Flow Log

## [V3.1.0-Strategic Shift] - 2026-06-08

### Added [新增]

* **[ZH/EN] 双轨制数据收集 (Dual-Track Data Collection)**: 新增静默的观点轨（Mind Track）与生活轨（Life Track）数据分离机制，全面替代原有的单维情绪倾诉。/ Introduced silent separation of Mind Track and Life Track data, completely replacing the one-dimensional emotional venting.
* **[ZH/EN] 情绪锚点与苏格拉底式镜像 (Emotional Anchors & Socratic Mirroring)**: 在倾诉页新增极简情绪标签（替代分值），并引入 AI 多轮镜像对话机制，引导情绪剥离。/ Added minimalist emotion tags (replacing scores) on the venting page, and introduced an AI multi-turn mirroring dialogue mechanism to guide emotional detachment.
* **[ZH/EN] 小票反刍机制 (Receipt Rumination)**: 允许在怀念区唤醒历史情绪小票，开启追回对话并追加时间戳补丁日志。/ Allowed waking up historical emotion receipts in the Archive for follow-up conversations and appending timestamped patch logs.
* **[ZH/EN] 植物生命体征实体 (Plant Vital Signs Entity)**: 漫游区新增植物实体，引入天级别的脱离人类意志的时间流逝与自然枯荣循环。/ Added a plant entity to the Roaming Zone, introducing a daily cycle of natural decay and time passage independent of human will.

### Changed [重构]

* **[ZH/EN] 首页极简分诊台 (Minimalist Home Triage)**: 移除首页大段世界观底噪描述，收束为平等的双轨入口（情绪倾诉 / 记录一件小事）。/ Removed lengthy world-building background descriptions from the homepage, consolidating into egalitarian dual-track entries.
* **[ZH/EN] 漫游区惰性重构 (Roaming Zone Lazy Refactoring)**: 废除后台定时推演引擎。所有痕迹（墙壁、木凳、铁筐）改为基于前端时间差的惰性衰减渲染。/ Abolished the backend timed derivation engine. All traces now use frontend time-difference-based lazy decay rendering.
* **[ZH/EN] 发呆区心流重塑 (Daydream Flow Revamp)**: 废除轮播幻灯片模式，重构为由 LLM 驱动、时间递进式留白（5s->22s）的沉浸式水滴引擎。/ Abolished the slideshow mode, refactoring it into an immersive, LLM-driven progressive blank-interval engine.
* **[ZH/EN] 焚烧区仪式闭环 (Incinerator Ritual Closure)**: 从旧物区剥离。加入绝对冷酷的 LLM 物理残骸鉴定，并在 CSS 碳化动画后强行植入 3 秒的静默黑屏期，交还用户主动离开权。/ Separated from the Archive. Added absolutely cold LLM physical remains appraisal, and forced a 3-second silent black screen post-carbonization animation, returning the active exit right to the user.

### Removed [移除]

* **[ZH/EN] 旧数据冗余表 (Redundant Data Tables)**: 物理删除了 `physical_traces`、`world_timeline_logs` 等表，全面收归至 ECS `entity_components`。/ Physically deleted legacy tables, fully consolidating into ECS `entity_components`.
* **[ZH/EN] 情绪分值系统 (Emotional Scoring System)**: 彻底斩断对用户情感的数字化评判。/ Completely severed digital evaluation of user emotions.


[ZH/EN] 漫游区网格化重构 (Roaming Area Grid Refactoring): 彻底铲除漫游区的无序绝对定位，引入严格的 CSS 九宫格坐标与痕迹轮播状态机，解决文字重叠灾难。/ Eradicated chaotic absolute positioning in the Roaming Zone, introducing a strict CSS grid and trace carousel state machine to solve text overlap disasters.

[ZH/EN] 视觉降噪与质感重塑 (Visual Denoising & Texture Reshape): 废除时间轴上泛滥的彩色小图标。生活碎片改用“左边框引用块（Left-Border Blockquote）”极简渲染，凸显残缺物理质感。/ Abolished excessive colored icons on the timeline. Life fragments now use minimalist "Left-Border Blockquotes" to highlight a broken physical texture.

[ZH/EN] 交互折叠逻辑 (Interaction Folding Logic): 时间轴上的所有次级操作按钮（重新谈谈/销毁）、漫游区的交互面板，默认全量隐藏，点击后方可平滑展开。/ All secondary action buttons and interaction panels default to fully hidden, expanding smoothly only upon click.

Removed [移除]
[ZH/EN] 具象化 3D 头像 (Memoji/Avatars): 强行清退首页所有高饱和度卡通头像，捍卫避难所冷峻、孤独的美学底线。/ Forcibly removed all high-saturation cartoon avatars from the homepage to defend the sanctuary's cold and solitary aesthetic baseline.

[ZH/EN] 精确时间戳显示 (Exact Timestamps Display): 在历史追溯场景中彻底删除了 YYYY-MM-DD HH:MM 格式，剥离数据库日志感。/ Completely deleted exact date-time formats in historical tracing scenarios to strip away the database log feel.

[ZH/EN] 具有倾向性的社交文案 (Biased Social Copywriting): 移除了“我懂”、“我也一样”等带有主观评判色彩的互动按钮。/ Removed biased interactive buttons lik
