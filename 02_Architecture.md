# Architecture - 《End Here》系统全栈技术架构白皮书

## 1. 核心工程红线
- **绝对单页心流（SPA-First）**：全盘废弃 Next.js 基于文件夹的多路由跳转（MPA）。所有页面切换必须收束于 `app/page.tsx`，通过 `useSpaceStore` 状态机进行无缝场景淡入淡出及失焦溶解。
- **彻底的动静解耦**：禁止在前端或推演逻辑中硬编码任何实体属性。静态字典必须读表，动态状态必须通过状态机或时序库变更。

## 2. 状态机契约（Zustand Registry）
- `useSpaceStore`：管控全局场景路由（`entrance` | `speaking` | `resting` | `nostalgia`）。
- `useShelterStore`：管控本地小票缓存、数据引渡、以及基于自然日的铁筐领取冷却防通胀锁（`canClaimToday`）。
- `useWorldEngine`：物理动作快照合并引擎。负责 5 分钟心跳无感知合并物理动作，并利用 `navigator.sendBeacon` 静默向 `/api/world/snapshot` 送出快照。

## 3. 惰性结算机制（Lazy Settlement）
- 空间状态不进行高频服务器轮询。由 `settlement.ts` 引擎接管，在用户跨越时间切片（如 `DEEP_NIGHT`）且吧台为空时，进行概率性物理组件注入（如硬薄荷糖、橘子）。