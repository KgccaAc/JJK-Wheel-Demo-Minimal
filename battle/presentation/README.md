# 战斗展示封装

`RoundHistoryFormatter.gd` 只接收已经提交的 `RoundPackage`，把命中、资源变化、承伤与异常状态格式化为 RoundHistory 文本。

它不得读取活动 `BattleFlowSession` 或重新执行命中、伤害、费用规则。回合前字段来自 `round_history_before` 的脱敏摘要，不包含手牌或牌库。

