# 已清空的 Legacy Runtime 目录

本目录**已无任何脚本**，仅保留此说明文件作为历史记录。

## 2026-09-20 清理

原目录内两个文件均已迁出，理由是原 README 声称「仅历史 fixture 与可用性预览」
与实际引用情况不符：

| 文件 | 实际引用 | 处理 |
| --- | --- | --- |
| `AtomicEffectInterpreter.gd`（298 行） | **1 处生产引用**：`battle/data/CardAvailabilityService.gd`，用于「已选卡牌对当前候选的状态影响」预演 | 迁至 `battle/rules/`，重新归类为无依赖规则原语 |
| `HandDealer.gd`（约 340 行） | **0 处代码引用**（仅 `docs/` 一处叙述性提及与 `tests/ap_cleanup_acceptance.mjs` 的字符串读取） | 归档至 `_archive/legacy-runtime/` |

## 结论

`battle/runtime/` 曾同时容纳「仍在生产使用的原语」与「确定废弃的旧发牌器」，
README 一刀切地称其为 legacy，导致 `battle/data/CardAvailabilityService` 依赖了
一个被文档标记为废弃的模块 —— 这正是先前记录在案的「文档与代码自相矛盾」。

清理后的分层：

- `battle/rules/` —— 零依赖纯原语（`BattleState`、`ActionCostResolver`、`AtomicEffectInterpreter`）
- `battle/core/` —— 会话编排与规则执行
- `battle/data/` —— 只读数据仓库与可用性查询
- `battle/v3/` —— 版本化规则实现
- `battle/online/` —— 联机传输与网关

## 历史（原文保留）

`BattleRulesV1Session`、`TurnTransaction`、`CardZoneManager` 先前已移除：
它们各自推进独立状态，与生产命令链路重复。
fixture 断言必须先通过公开命令驱动 `BattleFlowSession`，再检查其
canonical snapshot 或 round package。
AP 字段与 AP 效果已废弃，被当前流程忽略。
