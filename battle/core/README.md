# 战斗核心组件

## 唯一生产入口

`BattleFlowSession` 是离线生产战斗的唯一会话。界面、编排器与本地命令网关只能提交版本化命令，不能直接写入 `BattleState`。

命令流为：`BattleFlowSession` 校验阶段与 revision → `BattleResolutionPipeline` 预演并计算 CE → `CoreActionResolver` 提交原子效果 → `BattleState` 生成 canonical snapshot 与 `RoundPackage`。

失败的行动在工作副本中回滚；Presenter 只读取已提交快照和回合包。

## 组件职责

- `BattleResolutionPipeline`：唯一的生产费用/修正预演边界，输出有阶段标记的 trace。
- `ModifierPipeline`：纯修正与 trace 聚合，不持有会话。
- `CoreActionResolver`：执行原子效果并写入工作状态；不得由 UI 直接调用。
- `SourceFixtureAdapter`：只读源 fixture 装载器；fixture 必须驱动 `BattleFlowSession`，不能建立第二生产会话。

## 依赖方向

本目录依赖 `battle/rules/`（纯原语基座）与 `battle/data/`（只读数据仓库），
方向为 `core → rules`、`core → data`。

- `BattleState` 与 `ActionCostResolver` 已迁至 `battle/rules/`，
  它们是零依赖原语，不属于会话编排层。
- `battle/rules/` **不得**反向引用 `core`；这是维持无环依赖的关键约束。

`battle/runtime/` 仅保留历史 fixture 与可用性预览所需代码，不能加入新规则。

