# 历史运行时归档

存放从 `battle/runtime/` 迁出、且确认无生产引用的旧实现。

## HandDealer.gd（2026-09-20 归档）

- 原路径：`res://battle/runtime/HandDealer.gd`（约 340 行）
- 原依赖：`battle/data/BattleDataRepository.gd`、`battle/data/CardViewModelFactory.gd`
- 归档依据：全仓检索仅 2 处提及，**均非代码调用**
  - `docs/story-first-chapter-production-design.md:87` —— 叙述性提及旧链路
    `LoginCardCharacterProjector -> BattleEligibility -> CardCandidateBuilder -> HandDealer`
  - `tests/ap_cleanup_acceptance.mjs:29` —— 以字符串方式读取文件内容做「已清理」断言
- 当前发牌逻辑由 `battle/core/BattleFlowSession.gd` 的阶段机持有
  （`DEAL` 阶段 + `NORMAL_HAND_SIZE` / `RETAINED_HAND_SIZE` 常量）
