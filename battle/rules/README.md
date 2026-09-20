# 战斗规则原语（无依赖基座层）

本目录只存放**零外部依赖的纯规则原语**，是整个战斗模块的依赖基座。
任何其他战斗子目录（`core` / `data` / `v3` / `runtime` / `online` / `presentation`）
都可以引用本目录，而**本目录不得反向引用它们中的任何一个**。

这条约束是打破 `battle/core ⟷ battle/data` 循环依赖的关键：
原先 `battle/data/CardAvailabilityService` 为了判断「这张牌能不能打」，必须引用
`battle/core/BattleState` 与 `battle/core/ActionCostResolver`，从而与 `core` 形成环路。

## 成员

### `BattleState.gd`（151 行，零依赖）

战斗状态的唯一权威容器。

- `ZONE_NAMES`：7 个卡区（`deck` / `draw` / `hand` / `selected` / `discard` / `exile` / `domain`）
- `MAX_RETAINED_EVENTS = 128`：事件环形上限
- `revision`：每次写入自增，用于乐观并发校验
- `canonical_snapshot()`：输出含 `sha256 state_hash` 的规范化快照，供联机一致性比对
- `restore_canonical_snapshot()`：从快照恢复；对 HTTP/JSON 反序列化出的
  **无类型 Array 做逐个字典重建**，避免 `Array[Dictionary]` 边界赋值崩溃

### `ActionCostResolver.gd`（12 行，零依赖）

基础 CE 成本的无状态计算器。

```
resolve_ce_cost(cost, max_ce, action_ce_delta) -> float
```

取 `cost.ce`、`max_ce * cost.ceRatio`、`cost.minCe` 三者最大值再加 delta，
并夹紧到非负。**生产调用必须经由 `BattleResolutionPipeline`**，
不允许 UI 或会话外代码自行拼接修正（否则会绕过修正 trace）。

### `AtomicEffectInterpreter.gd`（298 行，零依赖）

原子效果的轻量解释器，用于**预演**而非提交。

```
is_supported_tool(tool) -> bool
execute_atomic_effect(effect, state, source, target) -> Dictionary
```

`SUPPORTED_TOOLS` 声明了 50 个受支持的 effect tool。
它只改传入的 `state` 副本，不回写生产状态，因此适合在
`CardAvailabilityService` 中预演「已选卡牌对当前候选造成的影响」。

> 2026-09-20 由 `battle/runtime/` 迁入。原先它被 `battle/runtime/README.md`
> 标记为 legacy，但实际有 1 处生产引用，属于文档与代码不符，已一并修正。

## 为什么不是 `battle/core`

这两个类曾经放在 `battle/core`，但它们的语义是「规则」而非「会话编排」：
`core` 的职责是驱动阶段机与命令校验，而 `BattleState` / `ActionCostResolver`
是被所有人使用的**被动数据与算术**。放在 `core` 会让 `data` 层的只读查询
被迫依赖 `core` 的编排层，形成反向依赖。

判定标准：**一个类如果只有数据字段与纯函数、且不 preload 任何战斗模块内文件，
它就属于 `rules/`。**
